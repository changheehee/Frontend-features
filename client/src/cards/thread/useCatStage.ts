import { useEffect } from 'react';
import type { RefObject } from 'react';
import {
  AnimationMixer,
  Box3,
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  Mesh,
  PerspectiveCamera,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { AnimationAction, Material, Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import catModelUrl from './oiiaCat.glb?url';

const BACKGROUND_COLOR = 0xffffff;
const FIELD_OF_VIEW_DEGREES = 30;
const FRAMING_MARGIN = 1.2;
const MAX_PIXEL_RATIO = 1.5;

export function useCatStage(
  stageRef: RefObject<HTMLDivElement | null>,
  playbackRef: RefObject<HTMLProgressElement | null>,
) {
  useEffect(
    function showSpinningCat() {
      const stage = stageRef.current!;
      const playback = playbackRef.current!;
      const renderer = new WebGLRenderer({ antialias: true });
      const scene = new Scene();
      const camera = new PerspectiveCamera(FIELD_OF_VIEW_DEGREES, 1, 0.1, 5000);
      const resizeObserver = new ResizeObserver(fitToStage);
      const loading = new AbortController();
      const cat: CatAnimation = { mixer: null, playbackAction: null, lastFrameTime: null };
      const shouldAnimate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      playback.value = 0;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
      renderer.setClearColor(BACKGROUND_COLOR);
      stage.append(renderer.domElement);
      addLights(scene);
      resizeObserver.observe(stage);
      new GLTFLoader().loadAsync(catModelUrl).then(placeCat).catch(reportLoadFailure);
      renderer.setAnimationLoop(drawFrame);

      function placeCat(gltf: GLTF) {
        if (loading.signal.aborted) {
          disposeObject(gltf.scene);
          return;
        }

        frameModel(gltf.scene, camera);
        scene.add(gltf.scene);
        const mixer = new AnimationMixer(gltf.scene);
        const actions = gltf.animations.map(function playClip(clip) {
          return mixer.clipAction(clip).play();
        });
        const [firstAction] = actions;
        cat.mixer = mixer;
        cat.playbackAction = firstAction === undefined ? null : firstAction;
      }

      function drawFrame(time: DOMHighResTimeStamp) {
        const elapsedSeconds = cat.lastFrameTime === null ? 0 : (time - cat.lastFrameTime) / 1000;
        cat.lastFrameTime = time;

        if (shouldAnimate && cat.mixer !== null) {
          cat.mixer.update(elapsedSeconds);
        }

        if (cat.playbackAction !== null) {
          playback.value = cat.playbackAction.time / cat.playbackAction.getClip().duration;
        }

        renderer.render(scene, camera);
      }

      function fitToStage() {
        renderer.setSize(stage.clientWidth, stage.clientHeight, false);
        camera.aspect = stage.clientWidth / stage.clientHeight;
        camera.updateProjectionMatrix();
      }

      function reportLoadFailure(error: unknown) {
        console.error('고양이 3D 모델을 불러오지 못했습니다.', error);
      }

      return function removeCat() {
        loading.abort();
        renderer.setAnimationLoop(null);
        resizeObserver.disconnect();
        disposeObject(scene);
        renderer.dispose();
        renderer.domElement.remove();
      };
    },
    [stageRef, playbackRef],
  );
}

type CatAnimation = {
  mixer: AnimationMixer | null;
  playbackAction: AnimationAction | null;
  lastFrameTime: number | null;
};

function addLights(scene: Scene) {
  const keyLight = new DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(3, 5, 4);
  scene.add(new HemisphereLight(0xffffff, 0xdfe3ea, 2.2), keyLight);
}

function frameModel(model: Object3D, camera: PerspectiveCamera) {
  const bounds = new Box3().setFromObject(model, true);
  const size = bounds.getSize(new Vector3());
  const visibleHeight = size.y * FRAMING_MARGIN;
  const distance = visibleHeight / (2 * Math.tan(MathUtils.degToRad(FIELD_OF_VIEW_DEGREES / 2)));

  model.position.sub(bounds.getCenter(new Vector3()));
  camera.position.set(0, size.y * 0.08, distance + size.z / 2);
  camera.lookAt(0, 0, 0);
}

function disposeObject(root: Object3D) {
  root.traverse(function disposeMesh(object) {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      [object.material].flat().forEach(disposeMaterial);
    }
  });
}

function disposeMaterial(material: Material) {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) {
      value.dispose();
    }
  }

  material.dispose();
}
