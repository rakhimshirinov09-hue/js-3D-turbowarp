/**
 * Turbowarp 3D Extension - COMPLETE SINGLE FILE
 * Full-featured 3D rendering, physics, LOD, and bone system
 * 
 * Installation for Turbowarp Desktop:
 * 1. Open Turbowarp Desktop
 * 2. Click "Add Extension" → "Load Custom Extension"
 * 3. Paste the URL: https://raw.githubusercontent.com/rakhimshirinov09-hue/js-3D-turbowarp/main/turbowarp-3d-extension.js
 * 
 * Installation for Turbowarp Web:
 * 1. Go to https://turbowarp.org/
 * 2. Open DevTools (F12) → Console
 * 3. Paste this code:
 *    fetch('https://raw.githubusercontent.com/rakhimshirinov09-hue/js-3D-turbowarp/main/turbowarp-3d-extension.js')
 *      .then(r => r.text()).then(code => eval(code));
 * 
 * @author rakhimshirinov09-hue
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ============================================
  // BABYLON.JS INTEGRATION
  // ============================================
  
  const loadExternalScript = (url) => {
    return new Promise((resolve, reject) => {
      if (window[url.match(/(\w+)\.min\.js/)?.[1] || 'BABYLON']) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // ============================================
  // SCENE MANAGER
  // ============================================
  
  class SceneManager {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.canvas = this.createCanvas();
      this.engine = new BABYLON.Engine(this.canvas, true);
      this.scene = new BABYLON.Scene(this.engine);
      this.scene.collisionsEnabled = true;
      
      this.camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 10, 20));
      this.camera.attachControl(this.canvas, true);
      this.camera.speed = 0.5;
      
      const light1 = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), this.scene);
      light1.intensity = 0.8;
      
      const light2 = new BABYLON.PointLight('light2', new BABYLON.Vector3(10, 10, 10), this.scene);
      light2.intensity = 0.5;
      
      this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
      this.renderEnabled = true;
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
        document.body.appendChild(canvas);
      }
      return canvas;
    }

    setClearColor(r, g, b, a) {
      this.scene.clearColor = new BABYLON.Color4(r, g, b, a);
    }

    setCameraPosition(x, y, z) {
      this.camera.position = new BABYLON.Vector3(x, y, z);
    }

    setCameraTarget(x, y, z) {
      this.camera.setTarget(new BABYLON.Vector3(x, y, z));
    }

    startRenderLoop() {
      this.engine.runRenderLoop(() => {
        if (this.renderEnabled) {
          this.scene.render();
        }
      });

      window.addEventListener('resize', () => this.engine.resize());
    }

    setRenderEnabled(enabled) {
      this.renderEnabled = enabled;
    }

    dispose() {
      this.scene.dispose();
      this.engine.dispose();
    }
  }

  // ============================================
  // PHYSICS ENGINE (Cannon.js)
  // ============================================
  
  class PhysicsEngine {
    constructor(scene) {
      this.scene = scene;
      this.world = new CANNON.World();
      this.world.gravity.set(0, -9.8, 0);
      this.world.defaultContactMaterial.friction = 0.3;
      this.world.defaultContactMaterial.restitution = 0.3;
      this.bodies = new Map();
      this.substeps = 3;
      this.timeStep = 1 / 60;
      this.damping = 0.01;
      this.angularDamping = 0.01;
      
      this.startPhysicsLoop();
    }

    addPhysicsBody(mesh, type = 'dynamic', mass = 1) {
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
        linearDamping: this.damping,
        angularDamping: this.angularDamping
      });

      body.position.copy(mesh.position);
      this.world.addBody(body);

      mesh.physicsBody = body;
      mesh.physicsType = type;
      this.bodies.set(mesh.name || mesh.id, { mesh, body, type });

      mesh.receiveShadows = true;
      mesh.castShadows = true;

      return body;
    }

    removePhysicsBody(mesh) {
      if (mesh.physicsBody) {
        this.world.removeBody(mesh.physicsBody);
        this.bodies.delete(mesh.name || mesh.id);
        mesh.physicsBody = null;
      }
    }

    setGravity(x, y, z) {
      this.world.gravity.set(x, y, z);
    }

    startPhysicsLoop() {
      let lastTime = Date.now();
      const interval = setInterval(() => {
        const now = Date.now();
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;

        this.world.step(this.timeStep, deltaTime, this.substeps);

        this.bodies.forEach(({ mesh, body, type }) => {
          if (type !== 'static') {
            mesh.position.x = body.position.x;
            mesh.position.y = body.position.y;
            mesh.position.z = body.position.z;

            const quat = body.quaternion;
            const euler = new BABYLON.Vector3();
            BABYLON.Quaternion.FromArray([
              quat.x, quat.y, quat.z, quat.w
            ]).toEulerAnglesToRef(euler);
            mesh.rotation = euler;
          }
        });
      }, 16);
    }

    applyImpulse(mesh, forceX, forceY, forceZ) {
      if (mesh.physicsBody && mesh.physicsType !== 'static') {
        mesh.physicsBody.applyForce(
          new CANNON.Vec3(forceX, forceY, forceZ),
          mesh.physicsBody.position
        );
      }
    }

    setVelocity(mesh, vx, vy, vz) {
      if (mesh.physicsBody) {
        mesh.physicsBody.velocity = new CANNON.Vec3(vx, vy, vz);
      }
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
      try {
        const extension = this.getFileExtension(url).toLowerCase();
        let meshes;

        switch (extension) {
          case 'glb':
          case 'gltf':
            meshes = await this.loadGLTF(url);
            break;
          case 'obj':
            meshes = await this.loadOBJ(url);
            break;
          case 'stl':
            meshes = await this.loadSTL(url);
            break;
          case 'ply':
            meshes = await this.loadPLY(url);
            break;
          default:
            throw new Error(`Unsupported format: ${extension}`);
        }

        const model = this.mergeAndSetupMeshes(meshes, name);
        this.loadedModels.set(name, model);
        return model;
      } catch (error) {
        console.error(`Error loading model from URL: ${error}`);
        throw error;
      }
    }

    async loadFromZip(name, zipUrl) {
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
          throw new Error('No supported model file found in ZIP');
        }

        const fileData = await mainFile.async('arraybuffer');
        
        // Create temporary blob URL for loading
        const blob = new Blob([fileData], { type: 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);
        
        const meshes = await this.loadFromURL(name, blobUrl);
        this.loadedModels.set(name, meshes);
        return meshes;
      } catch (error) {
        console.error(`Error loading model from ZIP: ${error}`);
        throw error;
      }
    }

    async loadGLTF(url) {
      return new Promise((resolve, reject) => {
        BABYLON.SceneLoader.ImportMesh(
          '',
          this.getDirectory(url),
          this.getFileName(url),
          this.scene,
          (meshes) => resolve(meshes),
          null,
          (error) => reject(error)
        );
      });
    }

    async loadOBJ(url) {
      return new Promise((resolve, reject) => {
        BABYLON.SceneLoader.ImportMesh(
          '',
          this.getDirectory(url),
          this.getFileName(url),
          this.scene,
          (meshes) => resolve(meshes),
          null,
          (error) => reject(error)
        );
      });
    }

    async loadSTL(url) {
      return new Promise((resolve, reject) => {
        BABYLON.SceneLoader.ImportMesh(
          '',
          this.getDirectory(url),
          this.getFileName(url),
          this.scene,
          (meshes) => resolve(meshes),
          null,
          (error) => reject(error)
        );
      });
    }

    async loadPLY(url) {
      return new Promise((resolve, reject) => {
        BABYLON.SceneLoader.ImportMesh(
          '',
          this.getDirectory(url),
          this.getFileName(url),
          this.scene,
          (meshes) => resolve(meshes),
          null,
          (error) => reject(error)
        );
      });
    }

    mergeAndSetupMeshes(meshes, name) {
      if (meshes.length === 0) return null;
      if (meshes.length === 1) {
        return this.setupMesh(meshes[0], name);
      }

      const merged = BABYLON.Mesh.MergeMeshes(meshes);
      return this.setupMesh(merged, name);
    }

    setupMesh(mesh, name) {
      mesh.name = name;
      mesh.receiveShadows = true;
      mesh.castShadows = true;

      if (!mesh.material) {
        const material = new BABYLON.StandardMaterial(`${name}_mat`, this.scene);
        material.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        material.specularPower = 64;
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
  // LOD MANAGER (Level of Detail)
  // ============================================
  
  class LODManager {
    constructor(sceneManager) {
      this.sceneManager = sceneManager;
      this.scene = sceneManager.scene;
      this.camera = sceneManager.camera;
      this.lodGroups = new Map();
      this.chunkSize = 50;
      this.maxDistance = 500;
      this.maxRenderDistance = 1000;
      this.updateInterval = 100;
      this.startLODUpdateLoop();
    }

    setupLOD(mesh, distanceHigh = 10, distanceMedium = 50, distanceLow = 100) {
      const lodGroup = {
        mesh: mesh,
        distanceHigh: distanceHigh,
        distanceMedium: distanceMedium,
        distanceLow: distanceLow,
        currentLOD: 'high',
        lodMeshes: {}
      };

      lodGroup.lodMeshes.high = mesh;
      lodGroup.lodMeshes.medium = this.createSimplifiedMesh(mesh, 0.6, `${mesh.name}_lod_medium`);
      lodGroup.lodMeshes.low = this.createSimplifiedMesh(mesh, 0.3, `${mesh.name}_lod_low`);

      lodGroup.lodMeshes.medium.isVisible = false;
      lodGroup.lodMeshes.low.isVisible = false;

      this.lodGroups.set(mesh.name || mesh.id, lodGroup);
    }

    createSimplifiedMesh(mesh, ratio, name) {
      const cloned = mesh.clone(name);
      cloned.receiveShadows = mesh.receiveShadows;
      cloned.castShadows = false;
      return cloned;
    }

    setChunkSize(size) {
      this.chunkSize = size;
    }

    setMaxDistance(distance) {
      this.maxDistance = distance;
      this.maxRenderDistance = distance * 2;
    }

    startLODUpdateLoop() {
      setInterval(() => {
        this.updateLODs();
      }, this.updateInterval);
    }

    updateLODs() {
      const cameraPos = this.camera.position;

      this.lodGroups.forEach((lodGroup) => {
        const meshPos = lodGroup.mesh.position;
        const distance = BABYLON.Vector3.Distance(cameraPos, meshPos);

        let newLOD = 'high';
        if (distance > lodGroup.distanceMedium) {
          newLOD = 'low';
        } else if (distance > lodGroup.distanceHigh) {
          newLOD = 'medium';
        }

        if (distance > this.maxRenderDistance) {
          lodGroup.mesh.isVisible = false;
          lodGroup.lodMeshes.medium.isVisible = false;
          lodGroup.lodMeshes.low.isVisible = false;
          return;
        }

        if (newLOD !== lodGroup.currentLOD) {
          lodGroup.lodMeshes.high.isVisible = false;
          lodGroup.lodMeshes.medium.isVisible = false;
          lodGroup.lodMeshes.low.isVisible = false;
          lodGroup.lodMeshes[newLOD].isVisible = true;
          lodGroup.currentLOD = newLOD;
        }

        lodGroup.lodMeshes[newLOD].isVisible = true;
      });
    }

    getChunkKey(position) {
      const x = Math.floor(position.x / this.chunkSize);
      const y = Math.floor(position.y / this.chunkSize);
      const z = Math.floor(position.z / this.chunkSize);
      return `${x},${y},${z}`;
    }
  }

  // ============================================
  // BONE SYSTEM (Character Rigging)
  // ============================================
  
  class BoneSystem {
    constructor(sceneManager) {
      this.sceneManager = sceneManager;
      this.scene = sceneManager.scene;
      this.bones = new Map();
      this.attachments = new Map();
    }

    attachChild(child, parent, offsetX = 0, offsetY = 0, offsetZ = 0) {
      const attachmentKey = `${child.name}__${parent.name}`;
      const offset = new BABYLON.Vector3(offsetX, offsetY, offsetZ);

      const attachment = {
        child: child,
        parent: parent,
        offset: offset,
        localRotation: BABYLON.Quaternion.Identity(),
        localPosition: offset.clone()
      };

      this.attachments.set(attachmentKey, attachment);
      child._parentAttachment = attachment;

      const oldParent = child.parent;
      if (oldParent) {
        child.setParent(null);
      }

      child.setParent(parent);
      child.position = offset.clone();

      if (!this.bones.has(parent.name || parent.id)) {
        this.bones.set(parent.name || parent.id, {
          mesh: parent,
          children: []
        });
      }

      const parentBone = this.bones.get(parent.name || parent.id);
      if (!parentBone.children.includes(child)) {
        parentBone.children.push(child);
      }

      return attachment;
    }

    detachChild(child) {
      const parent = child.parent;
      if (!parent) return;

      const worldPos = BABYLON.Vector3.Zero();
      BABYLON.Vector3.TransformCoordinatesToRef(
        child.position,
        BABYLON.Matrix.Translation(parent.position.x, parent.position.y, parent.position.z),
        worldPos
      );

      child.setParent(null);
      child.position = worldPos;

      const attachmentKey = `${child.name}__${parent.name}`;
      this.attachments.delete(attachmentKey);

      const bone = this.bones.get(parent.name || parent.id);
      if (bone) {
        const idx = bone.children.indexOf(child);
        if (idx > -1) {
          bone.children.splice(idx, 1);
        }
      }
    }

    rotateLocal(mesh, x, y, z) {
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

    setLocalRotation(mesh, x, y, z) {
      const radX = BABYLON.Tools.ToRadians(x);
      const radY = BABYLON.Tools.ToRadians(y);
      const radZ = BABYLON.Tools.ToRadians(z);

      mesh.rotationQuaternion = BABYLON.Quaternion.FromEulerAngles(radX, radY, radZ);
    }

    positionLocal(mesh, x, y, z) {
      mesh.position = new BABYLON.Vector3(x, y, z);
    }

    getWorldPosition(mesh) {
      if (!mesh.parent) {
        return mesh.position.clone();
      }

      const worldPos = BABYLON.Vector3.Zero();
      BABYLON.Vector3.TransformCoordinatesToRef(
        mesh.position,
        BABYLON.Matrix.Translation(mesh.parent.position.x, mesh.parent.position.y, mesh.parent.position.z),
        worldPos
      );
      return worldPos;
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
        // Scene Management
        {
          opcode: 'scene_init',
          blockType: 'command',
          text: 'инициализировать 3D сцену [WIDTH] x [HEIGHT]',
          arguments: {
            WIDTH: { type: 'number', defaultValue: 800 },
            HEIGHT: { type: 'number', defaultValue: 600 }
          }
        },
        {
          opcode: 'scene_clear_color',
          blockType: 'command',
          text: 'цвет фона [R] [G] [B] [A]',
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
          text: 'камера в [X] [Y] [Z]',
          arguments: {
            X: { type: 'number', defaultValue: 0 },
            Y: { type: 'number', defaultValue: 10 },
            Z: { type: 'number', defaultValue: 20 }
          }
        },
        {
          opcode: 'scene_camera_target',
          blockType: 'command',
          text: 'камера смотрит на [X] [Y] [Z]',
          arguments: {
            X: { type: 'number', defaultValue: 0 },
            Y: { type: 'number', defaultValue: 0 },
            Z: { type: 'number', defaultValue: 0 }
          }
        },

        // Model Loading
        {
          opcode: 'model_load_zip',
          blockType: 'command',
          text: 'загрузить модель [NAME] из ZIP [URL]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            URL: { type: 'string', defaultValue: '' }
          }
        },
        {
          opcode: 'model_load_url',
          blockType: 'command',
          text: 'загрузить модель [NAME] [URL]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            URL: { type: 'string', defaultValue: '' }
          }
        },
        {
          opcode: 'model_position',
          blockType: 'command',
          text: 'модель [NAME] позиция [X] [Y] [Z]',
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
          text: 'модель [NAME] повернуть [X] [Y] [Z]',
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
          text: 'модель [NAME] масштаб [SCALE]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            SCALE: { type: 'number', defaultValue: 1 }
          }
        },
        {
          opcode: 'model_opacity',
          blockType: 'command',
          text: 'модель [NAME] прозрачность [OPACITY]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            OPACITY: { type: 'number', defaultValue: 1 }
          }
        },
        {
          opcode: 'model_delete',
          blockType: 'command',
          text: 'удалить модель [NAME]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' }
          }
        },

        // Lighting
        {
          opcode: 'light_add_directional',
          blockType: 'command',
          text: 'направленный свет [NAME] интенсивность [INTENSITY]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'light' },
            INTENSITY: { type: 'number', defaultValue: 1 }
          }
        },
        {
          opcode: 'light_add_point',
          blockType: 'command',
          text: 'точечный свет [NAME] [X] [Y] [Z] радиус [RANGE]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'light' },
            X: { type: 'number', defaultValue: 0 },
            Y: { type: 'number', defaultValue: 5 },
            Z: { type: 'number', defaultValue: 0 },
            RANGE: { type: 'number', defaultValue: 10 }
          }
        },
        {
          opcode: 'light_color',
          blockType: 'command',
          text: 'свет [NAME] цвет [R] [G] [B]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'light' },
            R: { type: 'number', defaultValue: 1 },
            G: { type: 'number', defaultValue: 1 },
            B: { type: 'number', defaultValue: 1 }
          }
        },
        {
          opcode: 'light_shadows_enable',
          blockType: 'command',
          text: 'тени для [NAME] разрешение [RESOLUTION]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'light' },
            RESOLUTION: { type: 'number', defaultValue: 2048 }
          }
        },

        // Materials
        {
          opcode: 'material_standard',
          blockType: 'command',
          text: 'материал [NAME] модель [MODEL] блеск [SPECULAR]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'mat' },
            MODEL: { type: 'string', defaultValue: 'model' },
            SPECULAR: { type: 'number', defaultValue: 0.5 }
          }
        },
        {
          opcode: 'material_reflection',
          blockType: 'command',
          text: 'отражение [NAME] интенсивность [INTENSITY]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            INTENSITY: { type: 'number', defaultValue: 0.5 }
          }
        },
        {
          opcode: 'material_emissive',
          blockType: 'command',
          text: 'свечение [NAME] [R] [G] [B] интенсивность [INTENSITY]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            R: { type: 'number', defaultValue: 1 },
            G: { type: 'number', defaultValue: 1 },
            B: { type: 'number', defaultValue: 1 },
            INTENSITY: { type: 'number', defaultValue: 0.5 }
          }
        },

        // Physics
        {
          opcode: 'physics_enable',
          blockType: 'command',
          text: 'физика [NAME] тип [TYPE] масса [MASS]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            TYPE: { type: 'string', menu: 'physicsType', defaultValue: 'dynamic' },
            MASS: { type: 'number', defaultValue: 1 }
          }
        },
        {
          opcode: 'physics_velocity',
          blockType: 'command',
          text: 'скорость [NAME] [VX] [VY] [VZ]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            VX: { type: 'number', defaultValue: 0 },
            VY: { type: 'number', defaultValue: 0 },
            VZ: { type: 'number', defaultValue: 0 }
          }
        },
        {
          opcode: 'physics_force',
          blockType: 'command',
          text: 'сила [NAME] [FX] [FY] [FZ]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            FX: { type: 'number', defaultValue: 0 },
            FY: { type: 'number', defaultValue: 0 },
            FZ: { type: 'number', defaultValue: 0 }
          }
        },
        {
          opcode: 'physics_gravity',
          blockType: 'command',
          text: 'гравитация [X] [Y] [Z]',
          arguments: {
            X: { type: 'number', defaultValue: 0 },
            Y: { type: 'number', defaultValue: -9.8 },
            Z: { type: 'number', defaultValue: 0 }
          }
        },
        {
          opcode: 'physics_friction',
          blockType: 'command',
          text: 'трение [NAME] [FRICTION]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            FRICTION: { type: 'number', defaultValue: 0.3 }
          }
        },

        // Pivot & Rotation
        {
          opcode: 'pivot_set',
          blockType: 'command',
          text: 'центр тяжести [NAME] [X] [Y] [Z]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            X: { type: 'number', defaultValue: 0 },
            Y: { type: 'number', defaultValue: 0 },
            Z: { type: 'number', defaultValue: 0 }
          }
        },
        {
          opcode: 'pivot_rotate_around',
          blockType: 'command',
          text: 'вращение [NAME] вокруг [PX] [PY] [PZ] угол [ANGLE] ось [AXIS]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            PX: { type: 'number', defaultValue: 0 },
            PY: { type: 'number', defaultValue: 0 },
            PZ: { type: 'number', defaultValue: 0 },
            ANGLE: { type: 'number', defaultValue: 90 },
            AXIS: { type: 'string', menu: 'axis', defaultValue: 'y' }
          }
        },

        // Bones
        {
          opcode: 'bone_attach',
          blockType: 'command',
          text: 'привязать [CHILD] к [PARENT] смещение [X] [Y] [Z]',
          arguments: {
            CHILD: { type: 'string', defaultValue: 'arm' },
            PARENT: { type: 'string', defaultValue: 'body' },
            X: { type: 'number', defaultValue: 0 },
            Y: { type: 'number', defaultValue: 0 },
            Z: { type: 'number', defaultValue: 0 }
          }
        },
        {
          opcode: 'bone_detach',
          blockType: 'command',
          text: 'отвязать [NAME]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'arm' }
          }
        },
        {
          opcode: 'bone_rotate_local',
          blockType: 'command',
          text: 'вращение кости [NAME] локально [X] [Y] [Z]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'arm' },
            X: { type: 'number', defaultValue: 0 },
            Y: { type: 'number', defaultValue: 0 },
            Z: { type: 'number', defaultValue: 0 }
          }
        },
        {
          opcode: 'bone_position_local',
          blockType: 'command',
          text: 'позиция кости [NAME] локально [X] [Y] [Z]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'arm' },
            X: { type: 'number', defaultValue: 0 },
            Y: { type: 'number', defaultValue: 0 },
            Z: { type: 'number', defaultValue: 0 }
          }
        },

        // LOD
        {
          opcode: 'lod_set_distance',
          blockType: 'command',
          text: 'LOD [NAME] дальние [D1] средние [D2] близкие [D3]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            D1: { type: 'number', defaultValue: 10 },
            D2: { type: 'number', defaultValue: 50 },
            D3: { type: 'number', defaultValue: 100 }
          }
        },
        {
          opcode: 'lod_set_chunk_size',
          blockType: 'command',
          text: 'размер чанка [SIZE]',
          arguments: {
            SIZE: { type: 'number', defaultValue: 50 }
          }
        },
        {
          opcode: 'lod_set_max_distance',
          blockType: 'command',
          text: 'макс дистанция отрисовки [DISTANCE]',
          arguments: {
            DISTANCE: { type: 'number', defaultValue: 500 }
          }
        },

        // Reporters
        {
          opcode: 'get_model_position',
          blockType: 'reporter',
          text: 'позиция [NAME] ось [AXIS]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            AXIS: { type: 'string', menu: 'axis', defaultValue: 'x' }
          }
        },
        {
          opcode: 'get_model_rotation',
          blockType: 'reporter',
          text: 'угол [NAME] ось [AXIS]',
          arguments: {
            NAME: { type: 'string', defaultValue: 'model' },
            AXIS: { type: 'string', menu: 'axis', defaultValue: 'y' }
          }
        }
      ];
    }

    getMenus() {
      return {
        physicsType: ['dynamic', 'static', 'kinematic'],
        axis: ['x', 'y', 'z'],
        bool: ['true', 'false']
      };
    }

    // Block implementations
    async scene_init(args) {
      try {
        this.sceneManager = new SceneManager(args.WIDTH, args.HEIGHT);
        this.physicsEngine = new PhysicsEngine(this.sceneManager.scene);
        this.modelLoader = new ModelLoader(this.sceneManager);
        this.lodManager = new LODManager(this.sceneManager);
        this.boneSystem = new BoneSystem(this.sceneManager);
        this.initialized = true;
        this.sceneManager.startRenderLoop();
        console.log('✓ 3D сцена инициализирована');
      } catch (error) {
        console.error('Error initializing 3D scene:', error);
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

    scene_camera_target(args) {
      if (!this.initialized) return;
      this.sceneManager.setCameraTarget(args.X, args.Y, args.Z);
    }

    async model_load_zip(args) {
      if (!this.initialized) return;
      try {
        const model = await this.modelLoader.loadFromZip(args.NAME, args.URL);
        this.objects.set(args.NAME, model);
        console.log(`✓ Модель загружена: ${args.NAME}`);
      } catch (error) {
        console.error('Error loading ZIP model:', error);
      }
    }

    async model_load_url(args) {
      if (!this.initialized) return;
      try {
        const model = await this.modelLoader.loadFromURL(args.NAME, args.URL);
        this.objects.set(args.NAME, model);
        console.log(`✓ Модель загружена: ${args.NAME}`);
      } catch (error) {
        console.error('Error loading model:', error);
      }
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

    model_opacity(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      if (model.material) {
        model.material.alpha = args.OPACITY;
      }
    }

    model_delete(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      model.dispose();
      this.objects.delete(args.NAME);
    }

    light_add_directional(args) {
      if (!this.initialized) return;
      const light = new BABYLON.DirectionalLight(args.NAME, new BABYLON.Vector3(0, -1, 0), this.sceneManager.scene);
      light.intensity = args.INTENSITY;
      this.lights.set(args.NAME, light);
    }

    light_add_point(args) {
      if (!this.initialized) return;
      const light = new BABYLON.PointLight(args.NAME, new BABYLON.Vector3(args.X, args.Y, args.Z), this.sceneManager.scene);
      light.range = args.RANGE;
      this.lights.set(args.NAME, light);
    }

    light_color(args) {
      if (!this.lights.has(args.NAME)) return;
      const light = this.lights.get(args.NAME);
      light.diffuse = new BABYLON.Color3(args.R, args.G, args.B);
    }

    light_shadows_enable(args) {
      if (!this.lights.has(args.NAME)) return;
      const light = this.lights.get(args.NAME);
      const shadowGenerator = new BABYLON.ShadowGenerator(args.RESOLUTION, light);
      shadowGenerator.useExponentialShadowMap = true;
      
      this.objects.forEach(mesh => {
        shadowGenerator.addShadowCaster(mesh);
      });
    }

    material_standard(args) {
      if (!this.objects.has(args.MODEL)) return;
      const model = this.objects.get(args.MODEL);
      const material = new BABYLON.StandardMaterial(args.NAME, this.sceneManager.scene);
      material.specularColor = new BABYLON.Color3(args.SPECULAR, args.SPECULAR, args.SPECULAR);
      material.specularPower = 32;
      if (model.material) model.material.dispose();
      model.material = material;
    }

    material_reflection(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      if (!model.material) return;
      model.material.reflectionTexture = new BABYLON.CubeTexture('https://www.babylonjs-playground.com/textures/skybox', this.sceneManager.scene);
      model.material.reflectionTexture.level = args.INTENSITY;
    }

    material_emissive(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      if (!model.material) return;
      model.material.emissiveColor = new BABYLON.Color3(args.R, args.G, args.B);
      model.material.emissiveColor = model.material.emissiveColor.scale(args.INTENSITY);
    }

    physics_enable(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      this.physicsEngine.addPhysicsBody(model, args.TYPE, args.MASS);
    }

    physics_velocity(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      if (model.physicsBody) {
        model.physicsBody.velocity = new CANNON.Vec3(args.VX, args.VY, args.VZ);
      }
    }

    physics_force(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      if (model.physicsBody) {
        model.physicsBody.applyForce(
          new CANNON.Vec3(args.FX, args.FY, args.FZ),
          model.physicsBody.position
        );
      }
    }

    physics_gravity(args) {
      if (!this.initialized) return;
      this.physicsEngine.setGravity(args.X, args.Y, args.Z);
    }

    physics_friction(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      if (model.physicsBody) {
        model.physicsBody.friction = args.FRICTION;
      }
    }

    pivot_set(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      model.setPivotPoint(new BABYLON.Vector3(args.X, args.Y, args.Z));
    }

    pivot_rotate_around(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      const pivotPoint = new BABYLON.Vector3(args.PX, args.PY, args.PZ);
      const angle = BABYLON.Tools.ToRadians(args.ANGLE);
      let axis = BABYLON.Axis.Y;
      if (args.AXIS === 'x') axis = BABYLON.Axis.X;
      else if (args.AXIS === 'z') axis = BABYLON.Axis.Z;
      
      model.position.subtractInPlace(pivotPoint);
      BABYLON.Vector3.TransformCoordinatesToRef(model.position, BABYLON.Matrix.RotationAxis(axis, angle), model.position);
      model.position.addInPlace(pivotPoint);
      model.rotate(axis, angle, BABYLON.Space.WORLD);
    }

    bone_attach(args) {
      if (!this.objects.has(args.CHILD) || !this.objects.has(args.PARENT)) return;
      const child = this.objects.get(args.CHILD);
      const parent = this.objects.get(args.PARENT);
      this.boneSystem.attachChild(child, parent, args.X, args.Y, args.Z);
    }

    bone_detach(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      this.boneSystem.detachChild(model);
    }

    bone_rotate_local(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      this.boneSystem.rotateLocal(model, args.X, args.Y, args.Z);
    }

    bone_position_local(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      this.boneSystem.positionLocal(model, args.X, args.Y, args.Z);
    }

    lod_set_distance(args) {
      if (!this.objects.has(args.NAME)) return;
      const model = this.objects.get(args.NAME);
      this.lodManager.setupLOD(model, args.D1, args.D2, args.D3);
    }

    lod_set_chunk_size(args) {
      if (!this.initialized) return;
      this.lodManager.setChunkSize(args.SIZE);
    }

    lod_set_max_distance(args) {
      if (!this.initialized) return;
      this.lodManager.setMaxDistance(args.DISTANCE);
    }

    get_model_position(args) {
      if (!this.objects.has(args.NAME)) return 0;
      const model = this.objects.get(args.NAME);
      if (args.AXIS === 'x') return model.position.x;
      if (args.AXIS === 'y') return model.position.y;
      if (args.AXIS === 'z') return model.position.z;
      return 0;
    }

    get_model_rotation(args) {
      if (!this.objects.has(args.NAME)) return 0;
      const model = this.objects.get(args.NAME);
      if (args.AXIS === 'x') return BABYLON.Tools.ToDegrees(model.rotation.x);
      if (args.AXIS === 'y') return BABYLON.Tools.ToDegrees(model.rotation.y);
      if (args.AXIS === 'z') return BABYLON.Tools.ToDegrees(model.rotation.z);
      return 0;
    }
  }

  // ============================================
  // INITIALIZATION & REGISTRATION
  // ============================================
  
  async function initializeExtension() {
    try {
      // Load Babylon.js libraries
      console.log('Загрузка Babylon.js...');
      await loadExternalScript('https://cdn.jsdelivr.net/npm/@babylonjs/core@6.30.0/babylon.min.js');
      await loadExternalScript('https://cdn.jsdelivr.net/npm/@babylonjs/loaders@6.30.0/babylonjs.loaders.min.js');
      
      console.log('Загрузка Cannon.js физики...');
      await loadExternalScript('https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js');
      
      console.log('Загрузка JSZip...');
      await loadExternalScript('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');

      console.log('✓ Все библиотеки загружены');

      // Register extension
      if (window.Scratch && window.Scratch.extensions) {
        const extension = new Turbowarp3DExtension();
        window.Scratch.extensions.register(extension);
        console.log('✓ Turbowarp 3D Extension зарегистрировано');
        console.log('✓ Расширение готово к использованию!');
        return true;
      } else if (window.VM && window.VM.extensionManager) {
        const extension = new Turbowarp3DExtension();
        window.VM.extensionManager.loadExtensionClass(extension, 'turbowarp3d');
        console.log('✓ Turbowarp 3D Extension загружено');
        return true;
      } else {
        console.error('Turbowarp API не обнаружен');
        return false;
      }
    } catch (error) {
      console.error('Ошибка при загрузке расширения:', error);
      return false;
    }
  }

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
  } else {
    initializeExtension();
  }

})();
