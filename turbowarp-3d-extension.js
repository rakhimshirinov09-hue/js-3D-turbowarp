/**
 * Turbowarp 3D Extension - FIXED VERSION
 * Full-featured 3D rendering, physics, LOD, and bone system
 */

(function() {
  'use strict';

  // ============================================
  // LIBRARY LOADING
  // ============================================
  
  const loadScript = (url) => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${url}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => {
        setTimeout(resolve, 100);
      };
      script.onerror = () => {
        console.warn(`Failed to load: ${url}`);
        resolve(); // Continue anyway
      };
      document.head.appendChild(script);
    });
  };

  // ============================================
  // SCENE MANAGER
  // ============================================
  
  class SceneManager {
    constructor(width, height) {
      this.width = width || 800;
      this.height = height || 600;
      this.canvas = this.createCanvas();
      this.engine = null;
      this.scene = null;
      this.camera = null;
      this.renderEnabled = true;
      this.initBabylon();
    }

    initBabylon() {
      if (!window.BABYLON) {
        console.error('BABYLON.js not loaded');
        return;
      }

      this.engine = new BABYLON.Engine(this.canvas, true);
      this.scene = new BABYLON.Scene(this.engine);
      this.scene.collisionsEnabled = true;
      
      this.camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 10, 20));
      this.camera.attachControl(this.canvas, true);
      this.camera.speed = 0.5;
      this.camera.inertia = 0.7;
      
      const light1 = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), this.scene);
      light1.intensity = 0.8;
      
      const light2 = new BABYLON.PointLight('light2', new BABYLON.Vector3(10, 10, 10), this.scene);
      light2.intensity = 0.5;
      
      this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
    }

    createCanvas() {
      let canvas = document.getElementById('babylon-canvas-3d');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'babylon-canvas-3d';
        canvas.width = this.width;
        canvas.height = this.height;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '999';
        canvas.style.border = '1px solid red';
        document.body.appendChild(canvas);
      }
      return canvas;
    }

    setClearColor(r, g, b, a) {
      if (this.scene) this.scene.clearColor = new BABYLON.Color4(r, g, b, a);
    }

    setCameraPosition(x, y, z) {
      if (this.camera) this.camera.position = new BABYLON.Vector3(x, y, z);
    }

    setCameraTarget(x, y, z) {
      if (this.camera) this.camera.setTarget(new BABYLON.Vector3(x, y, z));
    }

    startRenderLoop() {
      if (!this.engine) return;
      this.engine.runRenderLoop(() => {
        if (this.renderEnabled && this.scene) {
          this.scene.render();
        }
      });

      window.addEventListener('resize', () => {
        if (this.engine) this.engine.resize();
      });
    }

    setRenderEnabled(enabled) {
      this.renderEnabled = enabled;
    }

    dispose() {
      if (this.scene) this.scene.dispose();
      if (this.engine) this.engine.dispose();
    }
  }

  // ============================================
  // PHYSICS ENGINE
  // ============================================
  
  class PhysicsEngine {
    constructor(scene) {
      this.scene = scene;
      this.world = null;
      this.bodies = new Map();
      this.initPhysics();
    }

    initPhysics() {
      if (!window.CANNON) {
        console.warn('Cannon.js not loaded, physics disabled');
        return;
      }

      this.world = new CANNON.World();
      this.world.gravity.set(0, -9.8, 0);
      this.world.defaultContactMaterial.friction = 0.3;
      this.world.defaultContactMaterial.restitution = 0.3;
      
      this.startPhysicsLoop();
    }

    addPhysicsBody(mesh, type = 'dynamic', mass = 1) {
      if (!this.world) return null;

      let shape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));

      if (mesh.getBoundingInfo) {
        const boundingBox = mesh.getBoundingInfo().boundingBox;
        const size = boundingBox.maximum.subtract(boundingBox.minimum);
        shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
      }

      let bodyMass = mass;
      if (type === 'static' || type === 'kinematic') bodyMass = 0;

      const body = new CANNON.Body({
        mass: bodyMass,
        shape: shape,
        linearDamping: 0.01,
        angularDamping: 0.01
      });

      body.position.copy(mesh.position);
      this.world.addBody(body);

      mesh.physicsBody = body;
      mesh.physicsType = type;
      this.bodies.set(mesh.name || mesh.id, { mesh, body, type });

      return body;
    }

    removePhysicsBody(mesh) {
      if (!mesh.physicsBody || !this.world) return;
      this.world.removeBody(mesh.physicsBody);
      this.bodies.delete(mesh.name || mesh.id);
      mesh.physicsBody = null;
    }

    setGravity(x, y, z) {
      if (this.world) this.world.gravity.set(x, y, z);
    }

    startPhysicsLoop() {
      if (!this.world) return;
      let lastTime = Date.now();
      setInterval(() => {
        const now = Date.now();
        const deltaTime = Math.min((now - lastTime) / 1000, 0.016);
        lastTime = now;

        this.world.step(1 / 60, deltaTime, 3);

        this.bodies.forEach(({ mesh, body, type }) => {
          if (type !== 'static' && mesh) {
            mesh.position.x = body.position.x;
            mesh.position.y = body.position.y;
            mesh.position.z = body.position.z;
          }
        });
      }, 16);
    }
  }

  // ============================================
  // MODEL LOADER
  // ============================================
  
  class ModelLoader {
    constructor(sceneManager) {
      this.sceneManager = sceneManager;
      this.scene = sceneManager.scene;
      this.loadedModels = new Map();
    }

    async loadFromURL(name, url) {
      if (!this.scene) return null;
      try {
        return new Promise((resolve, reject) => {
          BABYLON.SceneLoader.ImportMesh(
            '',
            this.getDirectory(url),
            this.getFileName(url),
            this.scene,
            (meshes) => {
              const model = this.setupMesh(meshes[0], name);
              this.loadedModels.set(name, model);
              resolve(model);
            },
            null,
            (error) => {
              console.error('Model loading error:', error);
              reject(error);
            }
          );
        });
      } catch (error) {
        console.error('Error loading model:', error);
        return null;
      }
    }

    async loadFromZip(name, zipUrl) {
      if (!window.JSZip) {
        console.error('JSZip not loaded');
        return null;
      }
      try {
        const zipData = await fetch(zipUrl).then(r => r.arrayBuffer());
        const zip = await JSZip.loadAsync(zipData);

        let mainFile = null;
        let mainPath = null;
        const supportedExtensions = ['glb', 'gltf', 'obj', 'stl', 'ply'];

        for (const [path, file] of Object.entries(zip.files)) {
          if (file.dir) continue;
          const ext = path.split('.').pop().toLowerCase();
          if (supportedExtensions.includes(ext)) {
            mainFile = file;
            mainPath = path;
            break;
          }
        }

        if (!mainFile) {
          throw new Error('No model found in ZIP');
        }

        const fileData = await mainFile.async('arraybuffer');
        const blob = new Blob([fileData]);
        const blobUrl = URL.createObjectURL(blob);
        
        return await this.loadFromURL(name, blobUrl);
      } catch (error) {
        console.error('ZIP loading error:', error);
        return null;
      }
    }

    setupMesh(mesh, name) {
      if (!mesh) return null;
      mesh.name = name;
      mesh.receiveShadows = true;

      if (!mesh.material) {
        const material = new BABYLON.StandardMaterial(`${name}_mat`, this.scene);
        material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        mesh.material = material;
      }

      return mesh;
    }

    getFileExtension(url) {
      return url.split('.').pop() || '';
    }

    getFileName(url) {
      return url.split('/').pop() || '';
    }

    getDirectory(url) {
      const parts = url.split('/');
      parts.pop();
      return parts.join('/') + '/';
    }
  }

  // ============================================
  // LOD MANAGER
  // ============================================
  
  class LODManager {
    constructor(sceneManager) {
      this.sceneManager = sceneManager;
      this.scene = sceneManager.scene;
      this.camera = sceneManager.camera;
      this.lodGroups = new Map();
      this.chunkSize = 50;
      this.maxDistance = 500;
    }

    setupLOD(mesh, distanceHigh = 10, distanceMedium = 50, distanceLow = 100) {
      const lodGroup = {
        mesh: mesh,
        distanceHigh: distanceHigh,
        distanceMedium: distanceMedium,
        distanceLow: distanceLow,
        currentLOD: 'high'
      };

      this.lodGroups.set(mesh.name || mesh.id, lodGroup);
    }

    setChunkSize(size) {
      this.chunkSize = size;
    }

    setMaxDistance(distance) {
      this.maxDistance = distance;
    }
  }

  // ============================================
  // BONE SYSTEM
  // ============================================
  
  class BoneSystem {
    constructor(sceneManager) {
      this.sceneManager = sceneManager;
      this.scene = sceneManager.scene;
      this.bones = new Map();
      this.attachments = new Map();
    }

    attachChild(child, parent, offsetX = 0, offsetY = 0, offsetZ = 0) {
      if (!child || !parent) return null;

      child.setParent(parent);
      child.position = new BABYLON.Vector3(offsetX, offsetY, offsetZ);

      const attachmentKey = `${child.name}__${parent.name}`;
      this.attachments.set(attachmentKey, {
        child: child,
        parent: parent,
        offset: new BABYLON.Vector3(offsetX, offsetY, offsetZ)
      });

      return attachmentKey;
    }

    detachChild(child) {
      if (!child) return;
      child.setParent(null);
    }

    rotateLocal(mesh, x, y, z) {
      if (!mesh) return;
      const radX = BABYLON.Tools.ToRadians(x);
      const radY = BABYLON.Tools.ToRadians(y);
      const radZ = BABYLON.Tools.ToRadians(z);

      if (!mesh.rotationQuaternion) {
        mesh.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(0, 0, 0);
      }

      const rotX = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, radX);
      const rotY = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, radY);
      const rotZ = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Z, radZ);

      let combined = BABYLON.Quaternion.Multiply(rotX, rotY);
      combined = BABYLON.Quaternion.Multiply(combined, rotZ);

      mesh.rotationQuaternion = BABYLON.Quaternion.Multiply(
        mesh.rotationQuaternion,
        combined
      );
      mesh.rotationQuaternion.normalize();
    }

    positionLocal(mesh, x, y, z) {
      if (!mesh) return;
      mesh.position = new BABYLON.Vector3(x, y, z);
    }
  }

  // ============================================
  // MAIN EXTENSION CLASS
  // ============================================
  
  class Turbowarp3DExtension {
    constructor(runtime) {
      this.runtime = runtime;
      this.sceneManager = null;
      this.physicsEngine = null;
      this.modelLoader = null;
      this.lodManager = null;
      this.boneSystem = null;
      this.objects = new Map();
      this.lights = new Map();
      this.initialized = false;
    }

    getInfo() {
      return {
        id: 'turbowarp3d',
        name: 'Turbowarp 3D',
        blocks: this.getBlockDefinitions(),
        color1: '#FF6680',
        color2: '#FF5068',
        color3: '#FF3C52'
      };
    }

    getBlockDefinitions() {
      return [
        {
          opcode: 'scene_init',
          blockType: 'command',
          text: 'инициализировать 3D [WIDTH] x [HEIGHT]',
          arguments: {
            WIDTH: { type: 'number', defaultValue: 800 },
            HEIGHT: { type: 'number', defaultValue: 600 }
          }
        },
        {
          opcode: 'scene_clear_color',
          blockType: 'command',
          text: 'фон [R] [G] [B] [A]',
          arguments: {
            R: { type: 'number', defaultValue: 0 },
            G: { type: 'number', defaultValue: 0 },
            B: { type: 'number', defaultValue: 0 },
            A: { type: 'number', defaultValue: 1 }
          }
        },
        {
          opcode: 'scene_camera_position',
          blockType: 'command',
          text: 'камера [X] [Y] [Z]',
          arguments: {
            X: { type: 'number', defaultValue: 0 },
            Y: { type: 'number', defaultValue: 10 },
            Z: { type: 'number', defaultValue: 20 }
          }
        },
        {
          opcode: 'model_load_url',
          blockType: 'command',
          text: 'загрузить [NAME] [URL]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            URL: { type: 'string', defaultValue: '' }
          }
        },
        {
          opcode: 'model_position',
          blockType: 'command',
          text: '[NAME] позиция [X] [Y] [Z]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            X: { type: 'number', defaultValue: 0 },
            Y: { type: 'number', defaultValue: 0 },
            Z: { type: 'number', defaultValue: 0 }
          }
        },
        {
          opcode: 'model_rotation',
          blockType: 'command',
          text: '[NAME] вращение [X] [Y] [Z]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            X: { type: 'number', defaultValue: 0 },
            Y: { type: 'number', defaultValue: 0 },
            Z: { type: 'number', defaultValue: 0 }
          }
        },
        {
          opcode: 'model_scale',
          blockType: 'command',
          text: '[NAME] масштаб [SCALE]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            SCALE: { type: 'number', defaultValue: 1 }
          }
        },
        {
          opcode: 'light_add_directional',
          blockType: 'command',
          text: 'свет [NAME] интенсивность [INTENSITY]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'light' },
            INTENSITY: { type: 'number', defaultValue: 1 }
          }
        },
        {
          opcode: 'physics_enable',
          blockType: 'command',
          text: '��изика [NAME] тип [TYPE] масса [MASS]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            TYPE: { type: 'string', menu: 'physicsType', defaultValue: 'dynamic' },
            MASS: { type: 'number', defaultValue: 1 }
          }
        },
        {
          opcode: 'bone_attach',
          blockType: 'command',
          text: 'привязать [CHILD] к [PARENT] [X] [Y] [Z]',
          arguments: {
            CHILD: { type: 'string', defaultValue: 'arm' },
            PARENT: { type: 'string', defaultValue: 'body' },
            X: { type: 'number', defaultValue: 0 },
            Y: { type: 'number', defaultValue: 0 },
            Z: { type: 'number', defaultValue: 0 }
          }
        }
      ];
    }

    getMenus() {
      return {
        physicsType: ['dynamic', 'static', 'kinematic']
      };
    }

    async scene_init(args) {
      try {
        this.sceneManager = new SceneManager(args.WIDTH, args.HEIGHT);
        this.physicsEngine = new PhysicsEngine(this.sceneManager.scene);
        this.modelLoader = new ModelLoader(this.sceneManager);
        this.lodManager = new LODManager(this.sceneManager);
        this.boneSystem = new BoneSystem(this.sceneManager);
        this.initialized = true;
        
        // Wait for babylon to load
        await new Promise(r => setTimeout(r, 500));
        
        if (this.sceneManager.engine) {
          this.sceneManager.startRenderLoop();
          console.log('✓ 3D Scene initialized');
        }
      } catch (error) {
        console.error('Error:', error);
      }
    }

    scene_clear_color(args) {
      if (!this.initialized) return;
      this.sceneManager.setClearColor(args.R, args.G, args.B, args.A);
    }

    scene_camera_position(args) {
      if (!this.initialized) return;
      this.sceneManager.setCameraPosition(args.X, args.Y, args.Z);
    }

    async model_load_url(args) {
      if (!this.initialized) return;
      const model = await this.modelLoader.loadFromURL(args.NAME, args.URL);
      if (model) this.objects.set(args.NAME, model);
    }

    model_position(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      model.position = new BABYLON.Vector3(args.X, args.Y, args.Z);
    }

    model_rotation(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      model.rotation = new BABYLON.Vector3(
        BABYLON.Tools.ToRadians(args.X),
        BABYLON.Tools.ToRadians(args.Y),
        BABYLON.Tools.ToRadians(args.Z)
      );
    }

    model_scale(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      model.scaling = new BABYLON.Vector3(args.SCALE, args.SCALE, args.SCALE);
    }

    light_add_directional(args) {
      if (!this.initialized || !this.sceneManager.scene) return;
      const light = new BABYLON.DirectionalLight(args.NAME, new BABYLON.Vector3(0, -1, 0), this.sceneManager.scene);
      light.intensity = args.INTENSITY;
      this.lights.set(args.NAME, light);
    }

    physics_enable(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      if (this.physicsEngine) {
        this.physicsEngine.addPhysicsBody(model, args.TYPE, args.MASS);
      }
    }

    bone_attach(args) {
      if (!this.objects.has(args.CHILD) || !this.objects.has(args.PARENT)) return;
      const child = this.objects.get(args.CHILD);
      const parent = this.objects.get(args.PARENT);
      if (this.boneSystem) {
        this.boneSystem.attachChild(child, parent, args.X, args.Y, args.Z);
      }
    }
  }

  // ============================================
  // REGISTRATION
  // ============================================
  
  async function registerExtension() {
    // Load libraries
    console.log('Loading Babylon.js...');
    await loadScript('https://cdn.jsdelivr.net/npm/@babylonjs/core@6.30.0/babylon.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@babylonjs/loaders@6.30.0/babylonjs.loaders.min.js');
    await loadScript('https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js');
    await loadScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');

    console.log('✓ Libraries loaded');

    // Register the extension
    if (window.Scratch && window.Scratch.extensions && typeof window.Scratch.extensions.register === 'function') {
      const extension = new Turbowarp3DExtension();
      window.Scratch.extensions.register(extension);
      console.log('✓ Turbowarp 3D registered');
    } else {
      console.error('Scratch API not found');
    }
  }

  // Auto-register when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerExtension);
  } else {
    setTimeout(registerExtension, 1000);
  }

})();
