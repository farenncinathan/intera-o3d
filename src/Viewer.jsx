import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  RotateCcw,
  Plus,
  Minus,
  Expand,
  Shrink,
  Box,
  LoaderCircle,
} from "lucide-react";
import { createEngine } from "./engine.js";

export default function Viewer({
  explosion,
  selected,
  onSelect,
  autoRotate,
  resetKey,
  onHelp,
}) {
  const host = useRef(null);
  const api = useRef(null);
  const current = useRef({ explosion, selected, autoRotate });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [full, setFull] = useState(false);
  current.current = { explosion, selected, autoRotate };

  useEffect(() => {
    const element = host.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0xffffff, 0);
    element.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Modelo 3D interativo do motor V8 — arraste para girar, role para aproximar",
    );
    renderer.domElement.setAttribute("role", "img");
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-7, 7, 7, -7, 0.1, 100);
    camera.position.set(-10, 6.5, 13);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minZoom = 0.65;
    controls.maxZoom = 2.2;
    controls.maxPolarAngle = Math.PI * 0.76;
    controls.minPolarAngle = 0.25;
    controls.autoRotateSpeed = 0.6;
    controls.enablePan = false;
    controls.update();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.8;
    room.dispose();
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xfffaf3, 3);
    key.position.set(4, 9, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, {
      left: -8,
      right: 8,
      top: 8,
      bottom: -8,
      near: 0.1,
      far: 35,
    });
    key.shadow.bias = -0.001;
    key.shadow.normalBias = 0.04;
    key.shadow.radius = 4;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd7e5ff, 1.3);
    fill.position.set(-6, 3, -5);
    scene.add(fill);
    const engine = createEngine(THREE);
    scene.add(engine.group);
    engine.setExplosion(current.current.explosion / 100);
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 128;
    const context = shadowCanvas.getContext("2d");
    const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64);
    gradient.addColorStop(0, "rgba(50, 60, 75, .22)");
    gradient.addColorStop(0.4, "rgba(50, 60, 75, .10)");
    gradient.addColorStop(1, "rgba(50, 60, 75, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 6),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4.0;
    scene.add(floor);
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let press = null;
    const pick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray
        .intersectObject(engine.group, true)
        .find((h) => h.object.userData.partId);
      return hit?.object.userData.partId;
    };
    const down = (e) => {
      press = { x: e.clientX, y: e.clientY };
    };
    const up = (e) => {
      if (press && Math.hypot(press.x - e.clientX, press.y - e.clientY) < 5) {
        const id = pick(e);
        if (id) onSelect(id);
      }
      press = null;
    };
    const move = (e) => {
      renderer.domElement.style.cursor = pick(e) ? "pointer" : "grab";
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointermove", move);
    const resize = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      const aspect = width / height;
      const size = 6.0;
      camera.left = -size * aspect;
      camera.right = size * aspect;
      camera.top = size;
      camera.bottom = -size;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    let frame;
    let lastSelected;
    let lastTime = 0;
    let dirty = true;
    let displayed = current.current.explosion / 100;
    const render = (time = 0) => {
      frame = requestAnimationFrame(render);
      if (time - lastTime < 30) return;
      lastTime = time;
      const target = current.current.explosion / 100;
      if (Math.abs(displayed - target) > 0.0001) {
        displayed = THREE.MathUtils.lerp(displayed, target, 0.14);
        engine.setExplosion(displayed);
        renderer.shadowMap.needsUpdate = true;
        dirty = true;
      }
      const lookY = 0.5 + Math.max(0, displayed - 0.68) * 2.2;
      if (Math.abs(controls.target.y - lookY) > 0.001) {
        controls.target.y = lookY;
        dirty = true;
      }
      if (lastSelected !== current.current.selected) {
        engine.setSelected(current.current.selected);
        lastSelected = current.current.selected;
        dirty = true;
      }
      controls.autoRotate = current.current.autoRotate;
      if (controls.update() || dirty) {
        renderer.render(scene, camera);
        dirty = false;
      }
    };
    controls.addEventListener("change", () => {
      dirty = true;
    });
    renderer.shadowMap.needsUpdate = true;
    api.current = {
      zoom: (by) => {
        camera.zoom = THREE.MathUtils.clamp(camera.zoom + by, 0.65, 2.2);
        camera.updateProjectionMatrix();
      },
      reset: () => {
        camera.position.set(-10, 6.5, 13);
        camera.zoom = 1;
        camera.updateProjectionMatrix();
        controls.target.set(0, 0.5, 0);
        controls.update();
      },
    };
    render();
    setReady(true);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointermove", move);
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
      });
      shadowTexture.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, [onSelect]);
  useEffect(() => {
    api.current?.reset();
  }, [resetKey]);
  useEffect(() => {
    const change = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.querySelector(".explorer").requestFullscreen();
    } catch {
      setFull(false);
    }
  };
  return (
    <>
      <div className="scene-backdrop">
        <span>V8</span>
      </div>
      <div className="scene" ref={host} />
      {!ready && (
        <div className="scene-loading">
          {failed ? (
            <>
              <Box size={28} />
              <span>
                O visualizador precisa de WebGL.
                <br />
                Abra em um navegador com aceleração gráfica.
              </span>
            </>
          ) : (
            <>
              <LoaderCircle className="spin" size={24} />
              <span>Preparando cada detalhe…</span>
            </>
          )}
        </div>
      )}
      <div className="viewer-topline">
        <div className="viewer-label">
          <Box size={16} />
          <span>ESPAÇO INTERATIVO</span>
          <i />
          <span className="live-text">3D em tempo real</span>
        </div>
        <button
          className="view-help"
          onClick={onHelp}
          aria-label="Ajuda do visualizador"
        >
          ?
        </button>
      </div>
      <div className="view-axis" aria-hidden="true">
        <span className="axis-y">Y</span>
        <span className="axis-z">Z</span>
        <span className="axis-x">X</span>
        <svg viewBox="0 0 50 50">
          <path
            d="M25 27V6M25 27 7 37M25 27l19 10"
            fill="none"
            stroke="#abb1bb"
            strokeWidth="1.5"
          />
          <circle cx="25" cy="27" r="2.5" fill="#ec493e" />
        </svg>
      </div>
      <div className="zoom-tools">
        <button
          onClick={() => api.current?.zoom(0.15)}
          aria-label="Aproximar"
          title="Aproximar"
        >
          <Plus size={17} />
        </button>
        <button
          onClick={() => api.current?.zoom(-0.15)}
          aria-label="Afastar"
          title="Afastar"
        >
          <Minus size={17} />
        </button>
        <span />
        <button
          onClick={() => api.current?.reset()}
          aria-label="Restaurar câmera"
          title="Restaurar câmera"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={fullscreen}
          aria-label={full ? "Sair da tela cheia" : "Tela cheia"}
          title="Tela cheia"
        >
          {full ? <Shrink size={17} /> : <Expand size={17} />}
        </button>
      </div>
      <div className="scene-caption">
        <span className="caption-line" /> V8 BITURBO <span>·</span> PERSPECTIVA
        LIVRE
      </div>
    </>
  );
}
