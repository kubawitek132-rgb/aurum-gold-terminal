'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import styles from './BuildingScene.module.css';
import { BIURO_FLOORS, type BiuroFloorInventory } from '@/lib/biuroStructure';

export interface BuildingSceneProps {
  selectedFloor: string;
  onSelectFloor: (id: string) => void;
  resetKey?: number;
  structure?: readonly BiuroFloorInventory[];
}

const FLOOR_COLORS: Record<string, number> = { aurum: 0xf1c673, coin: 0x51d7e8, hq: 0xc4f078 };

type FloorView = {
  group: THREE.Group;
  y: number;
  accent: THREE.MeshStandardMaterial;
  slab: THREE.MeshStandardMaterial;
  label: THREE.SpriteMaterial;
  halo: THREE.Mesh;
};

/** A procedural cutaway model. The architecture is a navigation surface, not telemetry. */
export function BuildingScene({ selectedFloor, onSelectFloor, resetKey = 0, structure = BIURO_FLOORS }: BuildingSceneProps) {
  const floors = structure.map(floor => ({ ...floor, color: FLOOR_COLORS[floor.id] ?? 0xa6a4ff }));
  const hostRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selectedFloor);
  const selectRef = useRef(onSelectFloor);
  const resetRef = useRef<() => void>(() => {});
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => { selectedRef.current = selectedFloor; }, [selectedFloor]);
  useEffect(() => { selectRef.current = onSelectFloor; }, [onSelectFloor]);
  useEffect(() => { resetRef.current(); }, [resetKey]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setFailed(true);
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080f15, 0.014);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 180);
    const defaultPosition = new THREE.Vector3(18, 14, 22);
    const defaultTarget = new THREE.Vector3(0, 4.7, 0);
    camera.position.copy(defaultPosition);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setClearColor(0x080f15, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = host.clientWidth > 680;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.className = styles.canvas;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Interaktywny model trzech pięter biura. Stanowiska odpowiadają źródłowemu wykazowi ról. Przeciągnij, aby obrócić. Kółko myszy przybliża. Strzałki góra i dół wybierają piętro.');
    host.appendChild(canvas);

    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(defaultTarget);
    controls.enableDamping = !reducedMotion.matches;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.minDistance = 12;
    controls.maxDistance = 46;
    controls.minPolarAngle = Math.PI * 0.15;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minAzimuthAngle = -Math.PI * 0.26;
    controls.maxAzimuthAngle = Math.PI * 0.64;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.75;
    controls.update();
    resetRef.current = () => {
      camera.position.copy(defaultPosition);
      controls.target.copy(defaultTarget);
      controls.update();
    };

    scene.add(new THREE.HemisphereLight(0xb8e5ee, 0x17222a, 2.1));
    const key = new THREE.DirectionalLight(0xe0f0ff, 3.1);
    key.position.set(7, 20, 11);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 17;
    key.shadow.camera.bottom = -9;
    key.shadow.normalBias = 0.04;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x60bdcc, 2.5);
    rim.position.set(-10, 9, -7);
    scene.add(rim);
    const warm = new THREE.PointLight(0xc8e7a7, 28, 22, 2);
    warm.position.set(2, 13, 4);
    scene.add(warm);

    const allocatedMaterials = new Set<THREE.Material>();
    const material = (color: THREE.ColorRepresentation, roughness = 0.65, metalness = 0.12) => {
      const result = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      allocatedMaterials.add(result);
      return result;
    };
    const charcoal = material(0x17232b);
    const black = material(0x101c24);
    const steel = material(0x42545c, 0.4, 0.6);
    const lightWood = material(0x9a9b84, 0.82, 0.04);
    const deskTop = material(0x71818a, 0.68);
    const chairMaterial = material(0x203844, 0.85);
    const white = material(0xc5d9d8, 0.65);
    const foliage = material(0x4d7763, 0.95, 0);
    const warmLight = new THREE.MeshBasicMaterial({ color: 0xe4e9cb });
    const coolLight = new THREE.MeshBasicMaterial({ color: 0x9cecf0 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x74b6bd, metalness: 0.12, roughness: 0.15,
      transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide,
    });

    function box(parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, shadow = true) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    function cylinder(parent: THREE.Object3D, radius: number, height: number, x: number, y: number, z: number, mat: THREE.Material, topRadius = radius) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, radius, height, 12), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    const textures: THREE.Texture[] = [];
    function screenTexture(color: number, variant: number) {
      const element = document.createElement('canvas');
      element.width = 256;
      element.height = 160;
      const context = element.getContext('2d');
      if (!context) return null;
      const cssColor = `#${new THREE.Color(color).getHexString()}`;
      context.fillStyle = '#0b1820';
      context.fillRect(0, 0, 256, 160);
      context.fillStyle = cssColor;
      context.font = '600 12px monospace';
      context.fillText(variant === 2 ? 'RESEARCH / NOTES' : 'WORKSPACE / ANALYSIS', 12, 22);
      context.fillStyle = '#233a45';
      for (let row = 0; row < 4; row++) context.fillRect(12, 45 + row * 25, 230, 1);
      for (let col = 0; col < 6; col++) context.fillRect(12 + col * 45, 40, 1, 100);
      context.strokeStyle = cssColor;
      context.lineWidth = 2;
      context.beginPath();
      for (let point = 0; point < 16; point++) {
        const y = 109 - point * 2 + Math.sin(point * 1.65 + variant) * 17;
        if (!point) context.moveTo(14, y); else context.lineTo(14 + point * 15, y);
      }
      context.stroke();
      context.fillStyle = '#76939a';
      context.fillRect(12, 146, 65, 3);
      context.fillRect(160, 146, 78, 3);
      const texture = new THREE.CanvasTexture(element);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.push(texture);
      return texture;
    }

    const screenMaterials = floors.map((floor, index) => new THREE.MeshBasicMaterial({ map: screenTexture(floor.color, index), color: 0xffffff }));

    function plant(parent: THREE.Object3D, x: number, z: number, scale = 1) {
      const group = new THREE.Group();
      group.position.set(x, 0.08, z);
      group.scale.setScalar(scale);
      cylinder(group, 0.18, 0.32, 0, 0.16, 0, charcoal, 0.23);
      cylinder(group, 0.025, 0.6, 0, 0.6, 0, steel);
      for (let leaf = 0; leaf < 5; leaf++) {
        const angle = leaf * 2.4;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 5), foliage);
        mesh.position.set(Math.cos(angle) * 0.15, 0.66 + leaf * 0.075, Math.sin(angle) * 0.15);
        mesh.scale.set(0.75, 1.5, 0.65);
        mesh.rotation.z = Math.sin(angle) * 0.55;
        group.add(mesh);
      }
      parent.add(group);
    }

    function floorLabel(number: string, name: string, color: number) {
      const element = document.createElement('canvas');
      element.width = 512;
      element.height = 112;
      const context = element.getContext('2d');
      if (context) {
        context.fillStyle = 'rgba(9, 20, 27, 0.88)';
        context.fillRect(0, 6, 512, 100);
        context.fillStyle = `#${new THREE.Color(color).getHexString()}`;
        context.fillRect(0, 6, 5, 100);
        context.font = '500 36px monospace';
        context.fillText(number, 25, 67);
        context.fillStyle = '#e3edee';
        context.font = '500 30px sans-serif';
        context.fillText(name, 105, 64);
      }
      const texture = new THREE.CanvasTexture(element);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.push(texture);
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, opacity: 0.9 });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(3.1, 0.68, 1);
      return { sprite, mat };
    }

    // The plinth, entry steps and fine grid make the tower read as architecture.
    const plinth = new THREE.Group();
    scene.add(plinth);
    box(plinth, 14.4, 0.3, 11, 0, -0.12, 0, material(0x17262c, 0.9));
    box(plinth, 13.5, 0.18, 10.1, 0, 0.12, 0, charcoal);
    box(plinth, 5.5, 0.12, 0.7, 0.8, 0.05, 4.4, steel);
    box(plinth, 5.8, 0.08, 0.6, 0.8, -0.06, 4.9, charcoal);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), material(0x0a141b, 0.98, 0));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.3;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(100, 50, 0x1d3b43, 0x142b34);
    grid.position.y = -0.285;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.45;
    scene.add(grid);

    const halo = new THREE.Mesh(new THREE.RingGeometry(7.1, 7.12, 100), new THREE.MeshBasicMaterial({ color: 0x5d9299, transparent: true, opacity: 0.35 }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.275;
    scene.add(halo);
    for (const x of [-5, 5]) {
      plant(plinth, x, 2.6, 1.5);
      plant(plinth, x, -2.7, 1.6);
      box(plinth, 0.06, 0.06, 6.1, x, 0.23, 0, coolLight, false);
    }
    // No decorative people: every person in this model belongs to a declared station.
    box(plinth, 1.6, 0.1, 0.42, -4.6, 0.58, 0.4, lightWood);
    box(plinth, 0.08, 0.4, 0.36, -5.15, 0.34, 0.4, steel);
    box(plinth, 0.08, 0.4, 0.36, -4.05, 0.34, 0.4, steel);

    // A quiet skyline stays behind the cutaway and contains no external assets.
    const cityMaterial = material(0x0d1d27, 0.95);
    const cityLight = new THREE.MeshBasicMaterial({ color: 0x254453, transparent: true, opacity: 0.65 });
    for (let index = 0; index < 13; index++) {
      const x = -29 + index * 4.7;
      const z = -16 - (index % 3) * 4;
      const height = 2.4 + ((index * 7) % 11) * 0.8;
      box(scene, 2.4 + (index % 3) * 0.5, height, 3.2, x, height / 2 - 0.3, z, cityMaterial, false);
      for (let row = 1; row < height; row += 1.2) {
        box(scene, 1.7, 0.06, 0.02, x, row, z + 1.62, cityLight, false);
      }
    }

    const tower = new THREE.Group();
    scene.add(tower);
    const floorViews = new Map<string, FloorView>();
    const hitMeshes: THREE.Mesh[] = [];
    const invisible = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

    floors.forEach((floor, index) => {
      const group = new THREE.Group();
      const y = 0.43 + index * 3.2;
      group.position.y = y;
      group.userData.floorId = floor.id;
      tower.add(group);
      const accent = new THREE.MeshStandardMaterial({ color: floor.color, emissive: floor.color, emissiveIntensity: 0.55, roughness: 0.4 });
      const slab = new THREE.MeshStandardMaterial({ color: 0x30434b, roughness: 0.7, metalness: 0.3, emissive: floor.color, emissiveIntensity: 0.018 });
      box(group, 12, 0.24, 8.4, 0, 0, 0, slab);
      box(group, 12.05, 0.045, 0.055, 0, 0.015, 4.23, accent, false);
      box(group, 0.055, 0.045, 8.4, 6.05, 0.015, 0, accent, false);
      box(group, 11.55, 0.035, 7.95, 0, 0.145, 0, material(index === 3 ? 0x42514d : 0x34454a, 0.95, 0));

      // Two glazed perimeter walls; front and right are deliberately cut away.
      box(group, 11.75, 2.95, 0.045, 0, 1.63, -3.98, glass, false);
      box(group, 0.045, 2.95, 7.9, -5.88, 1.63, 0, glass, false);
      for (const x of [-5.85, -1.95, 1.95, 5.85]) {
        box(group, 0.085, 3.05, 0.085, x, 1.64, -3.95, steel);
      }
      box(group, 0.1, 3.05, 0.1, -5.85, 1.64, 3.95, steel);
      box(group, 0.08, 3.05, 0.08, -5.85, 1.64, 0, steel);
      box(group, 11.75, 0.1, 0.11, 0, 3.15, -3.95, steel);
      box(group, 0.11, 0.1, 8, -5.85, 3.15, 0, steel);
      box(group, 8, 0.045, 0.055, 0.55, 3.03, -3.89, warmLight, false);
      box(group, 0.035, 0.025, 5, -5.77, 3.01, 0.5, coolLight, false);

      // Service / elevator core anchors all four levels to the same building.
      box(group, 1.45, 2.48, 1.25, -5.05, 1.59, -3.18, charcoal);
      box(group, 0.9, 1.92, 0.035, -5.05, 1.16, -2.53, steel);
      box(group, 0.025, 1.9, 0.045, -5.05, 1.16, -2.5, black);
      box(group, 0.09, 0.21, 0.04, -4.43, 1.2, -2.5, accent, false);
      plant(group, 5.2, -3.2, 1.05);

      const stationRows = floor.departments.flatMap(department => department.stations.map(station => ({ station, department })));
      const stationCount = stationRows.length;
      group.userData.stationCount = stationCount;
      group.userData.departmentGroupCount = floor.departments.length;
      const columns = stationCount > 30 ? 9 : stationCount > 6 ? 4 : 3;
      const rows = Math.max(1, Math.ceil(stationCount / columns));
      const stationScale = stationCount > 30 ? 0.46 : 0.9;
      const stepX = stationCount > 30 ? 1.12 : 2.25;
      const stepZ = stationCount > 30 ? 0.95 : 2.05;
      const stationCoordinates = stationRows.map((entry, stationIndex) => ({
        ...entry,
        x: (stationIndex % columns - (columns - 1) / 2) * stepX + 0.28,
        z: (Math.floor(stationIndex / columns) - (rows - 1) / 2) * stepZ + 0.25,
      }));
      const stations = new THREE.Group();
      stations.name = `workstations:${floor.id}`;
      group.add(stations);
      // One group and one furniture instance per declared source role. No spare desks.
      stationCoordinates.forEach(({ station, department, x, z }) => {
        const identity = new THREE.Group();
        identity.name = `workstation:${station.id}`;
        identity.userData = { stationId: station.id, departmentId: department.id, installation: station.installation };
        identity.position.set(x, 0.19, z);
        stations.add(identity);
      });
      const transform = new THREE.Object3D();
      const parts: { geometry: THREE.BufferGeometry; mat: THREE.Material; x: number; y: number; z: number }[] = [
        { geometry: new THREE.BoxGeometry(1.65, 0.11, 0.88), mat: deskTop, x: 0, y: 0.78, z: 0 },
        { geometry: new THREE.BoxGeometry(0.85, 0.73, 0.45), mat: charcoal, x: 0, y: 0.37, z: -0.05 },
        { geometry: new THREE.BoxGeometry(1, 0.63, 0.08), mat: black, x: 0, y: 1.23, z: -0.15 },
        { geometry: new THREE.BoxGeometry(0.9, 0.53, 0.012), mat: screenMaterials[index], x: 0, y: 1.23, z: -0.1 },
        { geometry: new THREE.BoxGeometry(0.07, 0.25, 0.1), mat: steel, x: 0, y: 0.91, z: -0.15 },
        { geometry: new THREE.BoxGeometry(0.48, 0.025, 0.18), mat: black, x: 0, y: 0.85, z: 0.25 },
        { geometry: new THREE.BoxGeometry(0.48, 0.12, 0.45), mat: chairMaterial, x: 0, y: 0.48, z: 0.85 },
        { geometry: new THREE.BoxGeometry(0.47, 0.5, 0.09), mat: chairMaterial, x: 0, y: 0.78, z: 1.08 },
        { geometry: new THREE.CylinderGeometry(0.04, 0.04, 0.35, 7), mat: steel, x: 0, y: 0.27, z: 0.85 },
        { geometry: new THREE.CylinderGeometry(0.18, 0.14, 0.37, 8), mat: material(floor.color, 0.9), x: 0, y: 0.88, z: 0.85 },
        { geometry: new THREE.SphereGeometry(0.13, 8, 6), mat: material(0xc6b39d, 0.9), x: 0, y: 1.21, z: 0.85 },
      ];
      if (stationCount) {
        parts.forEach(part => {
          const instances = new THREE.InstancedMesh(part.geometry, part.mat, stationCount);
          instances.name = `station-furniture:${floor.id}`;
          instances.castShadow = stationCount < 30;
          instances.receiveShadow = true;
          stationCoordinates.forEach(({ x, z }, stationIndex) => {
            transform.position.set(x + part.x * stationScale, 0.19 + part.y * stationScale, z + part.z * stationScale);
            transform.scale.setScalar(stationScale);
            transform.updateMatrix();
            instances.setMatrixAt(stationIndex, transform.matrix);
          });
          instances.instanceMatrix.needsUpdate = true;
          stations.add(instances);
        });
        // Each source group gets its own small color plaque and numbered desk markers.
        const departmentColors = [0xb8c995, 0x76b6b9, 0xb9a4cc, 0xc9b28a, 0x8bb8cb, 0xa8bab0];
        floor.departments.forEach((department, departmentIndex) => {
          const members = stationCoordinates.filter(row => row.department.id === department.id);
          const color = departmentColors[departmentIndex % departmentColors.length];
          const plaqueMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 });
          members.forEach(({ x, z }) => box(group, stationScale * 1.6, 0.018, stationScale * 0.08, x, 0.2, z + stationScale * 0.65, plaqueMaterial, false));
          const first = members[0];
          if (first) {
            const sign = floorLabel(String(departmentIndex + 1).padStart(2, '0'), `${department.name} · ${members.length}`, color);
            sign.sprite.scale.set(stationCount > 30 ? 1.38 : 2.35, stationCount > 30 ? 0.3 : 0.51, 1);
            sign.sprite.position.set(first.x, stationCount > 30 ? 0.98 : 1.83, first.z - 0.3);
            group.add(sign.sprite);
          }
        });
      } else {
        parts.forEach(part => part.geometry.dispose());
        // An unverified HQ remains an architectural space, without invented staffing.
        const unknown = floorLabel('?', 'Wykaz HQ niepotwierdzony', floor.color);
        unknown.sprite.position.set(0.6, 1.4, 0);
        unknown.sprite.scale.set(6, 1.3, 1);
        group.add(unknown.sprite);
        plant(group, -4.5, 2.6, 1.8);
        plant(group, 4.5, 2.6, 1.8);
      }

      const label = floorLabel(floor.number, floor.name, floor.color);
      label.sprite.position.set(4.1, 0.26, 4.6);
      group.add(label.sprite);
      const hit = box(group, 12.1, 3.1, 8.5, 0, 1.5, 0, invisible, false);
      hit.userData.floorId = floor.id;
      hitMeshes.push(hit);
      const selectionHalo = box(group, 12.15, 0.025, 8.55, 0, -0.14, 0, new THREE.MeshBasicMaterial({ color: floor.color, transparent: true, opacity: 0.08, depthWrite: false }), false);
      floorViews.set(floor.id, { group, y, accent, slab, label: label.mat, halo: selectionHalo });
    });

    // Roof parapets and a slim antenna leave the HQ interior visible from above.
    const roofHeight = 0.43 + (floors.length - 1) * 3.2 + 3.22;
    box(tower, 12, 0.16, 0.28, 0, roofHeight, -4.01, steel);
    box(tower, 0.28, 0.16, 8.3, -5.9, roofHeight, 0, steel);
    cylinder(tower, 0.035, 1.65, -5.1, roofHeight + 0.72, -2, steel);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), new THREE.MeshBasicMaterial({ color: 0xc4f078 }));
    beacon.position.set(-5.1, roofHeight + 1.56, -2);
    tower.add(beacon);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPosition: { x: number; y: number } | null = null;
    let lastHovered: string | null = null;
    let dragging = false;
    function hitFloor(event: PointerEvent) {
      const bounds = canvas.getBoundingClientRect();
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(hitMeshes, false)[0]?.object.userData.floorId as string | undefined;
    }
    function onPointerDown(event: PointerEvent) {
      downPosition = { x: event.clientX, y: event.clientY };
      dragging = false;
      canvas.style.cursor = 'grabbing';
    }
    function onPointerMove(event: PointerEvent) {
      if (downPosition) {
        dragging = Math.hypot(event.clientX - downPosition.x, event.clientY - downPosition.y) > 6;
        if (dragging) return;
      }
      const id = hitFloor(event) || null;
      canvas.style.cursor = id ? 'pointer' : 'grab';
      if (lastHovered !== id) {
        lastHovered = id;
        setHovered(id);
      }
    }
    function onPointerUp(event: PointerEvent) {
      if (downPosition && !dragging && Math.hypot(event.clientX - downPosition.x, event.clientY - downPosition.y) < 7) {
        const id = hitFloor(event);
        if (id) selectRef.current(id);
      }
      downPosition = null;
      dragging = false;
      canvas.style.cursor = 'grab';
    }
    function onPointerLeave() {
      downPosition = null;
      lastHovered = null;
      setHovered(null);
      canvas.style.cursor = 'grab';
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const current = floors.findIndex(floor => floor.id === selectedRef.current);
        const next = Math.max(0, Math.min(floors.length - 1, current + (event.key === 'ArrowUp' ? 1 : -1)));
        selectRef.current(floors[next].id);
      } else if (event.key === 'Home') {
        event.preventDefault();
        resetRef.current();
      }
    }
    const onContextLost = (event: Event) => { event.preventDefault(); setFailed(true); };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('webglcontextlost', onContextLost);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      camera.aspect = width / height;
      // Preserve the tower's full silhouette in narrow portrait viewports.
      camera.fov = width / height < 0.82 ? 43 : 34;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame = 0;
    let previous = performance.now();
    let inView = true;
    const visibilityObserver = new IntersectionObserver(entries => { inView = entries[0]?.isIntersecting ?? true; }, { rootMargin: '100px' });
    visibilityObserver.observe(host);
    function render(now: number) {
      frame = window.requestAnimationFrame(render);
      if (document.hidden || !inView) { previous = now; return; }
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const easing = reducedMotion.matches ? 1 : 1 - Math.exp(-delta * 7);
      floorViews.forEach((view, id) => {
        const active = id === selectedRef.current;
        const hover = id === lastHovered;
        view.group.position.y = THREE.MathUtils.lerp(view.group.position.y, view.y + (active ? 0.11 : 0), easing);
        view.group.position.z = THREE.MathUtils.lerp(view.group.position.z, active ? 0.17 : 0, easing);
        view.accent.emissiveIntensity = THREE.MathUtils.lerp(view.accent.emissiveIntensity, active ? 1.5 : hover ? 1 : 0.45, easing);
        view.slab.emissiveIntensity = THREE.MathUtils.lerp(view.slab.emissiveIntensity, active ? 0.11 : 0.014, easing);
        view.label.opacity = THREE.MathUtils.lerp(view.label.opacity, active || hover ? 1 : 0.72, easing);
        (view.halo.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp((view.halo.material as THREE.MeshBasicMaterial).opacity, active ? 0.25 : 0.025, easing);
      });
      controls.update();
      renderer.render(scene, camera);
    }
    renderer.render(scene, camera);
    setReady(true);
    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      visibilityObserver.disconnect();
      controls.dispose();
      resetRef.current = () => {};
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Sprite) {
          if ('geometry' in object) geometries.add(object.geometry);
          const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
          objectMaterials.forEach(mat => materials.add(mat));
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      allocatedMaterials.forEach(mat => materials.add(mat));
      screenMaterials.forEach(mat => materials.add(mat));
      materials.forEach(mat => mat.dispose());
      textures.forEach(texture => texture.dispose());
      renderer.dispose();
      if (host.contains(canvas)) host.removeChild(canvas);
    };
  }, [structure]);

  const hoveredFloor = floors.find(floor => floor.id === hovered);

  return (
    <div className={styles.scene} data-ready={ready || failed} data-floor-count={floors.length} data-station-count={floors.reduce((sum, floor) => sum + floor.departments.reduce((count, department) => count + department.stations.length, 0), 0)}>
      <div ref={hostRef} className={styles.viewport} aria-hidden={failed || undefined} />
      {!ready && !failed && <div className={styles.loading} role="status"><span />Przygotowuję model biura</div>}
      {failed && (
        <div className={styles.fallback}>
          <div className={styles.fallbackTower} aria-hidden="true">
            {[...floors].reverse().map(floor => <i key={floor.id} data-active={selectedFloor === floor.id}><span /><span /><span /><span /></i>)}
          </div>
          <p>Widok 3D jest niedostępny w tej przeglądarce.</p>
          <span>Wybierz piętro, aby zajrzeć do środka.</span>
          <div className={styles.fallbackFloors}>
            {[...floors].reverse().map(floor => (
              <button key={floor.id} type="button" aria-pressed={selectedFloor === floor.id} onClick={() => onSelectFloor(floor.id)}>{floor.number} <span>{floor.name}</span></button>
            ))}
          </div>
        </div>
      )}
      {!failed && <div className={styles.modelNote}>MODEL INTERAKTYWNY <span>{floors.length} PIĘTRA · {floors.reduce((sum, floor) => sum + floor.departments.reduce((count, department) => count + department.stations.length, 0), 0)} STANOWISKA W WYKAZIE</span></div>}
      {!failed && hoveredFloor && <div className={styles.hoverLabel} aria-hidden="true"><span>{hoveredFloor.number}</span>{hoveredFloor.name}<b>↗</b></div>}
      {!failed && <div className={styles.controlsHint} aria-hidden="true"><span>↔</span> Obróć <i /> <span>⊕</span> Przybliż <i /> Kliknij piętro</div>}
    </div>
  );
}

export default BuildingScene;
