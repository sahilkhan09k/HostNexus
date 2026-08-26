"use client";

import dynamic from "next/dynamic";
import { Suspense, useRef, type ReactElement } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";

/* ─── Building geometry ─── */
function HotelBuilding() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.18;
    }
  });

  const stoneMat = new THREE.MeshStandardMaterial({ color: "#F0EAD6", roughness: 0.55, metalness: 0.05 });
  const wingMat = new THREE.MeshStandardMaterial({ color: "#E8DFCF", roughness: 0.6, metalness: 0.0 });
  const roofMat = new THREE.MeshStandardMaterial({ color: "#C8BBA0", roughness: 0.7, metalness: 0.0 });
  const windowMat = new THREE.MeshStandardMaterial({
    color: "#FDE68A",
    emissive: "#FDE68A",
    emissiveIntensity: 0.6,
    roughness: 0.1,
    metalness: 0.3,
  });
  const windowDarkMat = new THREE.MeshStandardMaterial({
    color: "#93C5FD",
    emissive: "#93C5FD",
    emissiveIntensity: 0.2,
    roughness: 0.1,
    metalness: 0.2,
  });

  // Window grid helper
  const WindowGrid = ({
    cols,
    rows,
    offsetX,
    offsetY,
    offsetZ,
    winW = 0.08,
    winH = 0.1,
    spacing = 0.22,
    vSpacing = 0.2,
    mat,
  }: {
    cols: number;
    rows: number;
    offsetX: number;
    offsetY: number;
    offsetZ: number;
    winW?: number;
    winH?: number;
    spacing?: number;
    vSpacing?: number;
    mat: THREE.Material;
  }) => {
    const windows: ReactElement[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + (c - (cols - 1) / 2) * spacing;
        const y = offsetY + r * vSpacing;
        windows.push(
          <mesh key={`w-${r}-${c}`} position={[x, y, offsetZ]} material={mat}>
            <boxGeometry args={[winW, winH, 0.01]} />
          </mesh>
        );
      }
    }
    return <>{windows}</>;
  };

  return (
    <group ref={groupRef} position={[0, -0.5, 0]}>
      {/* ── Main Tower ── */}
      <mesh position={[0, 1.0, 0]} material={stoneMat} castShadow>
        <boxGeometry args={[0.9, 2.0, 0.65]} />
      </mesh>

      {/* Tower roof cap */}
      <mesh position={[0, 2.12, 0]} material={roofMat}>
        <boxGeometry args={[0.94, 0.08, 0.69]} />
      </mesh>

      {/* Main tower — front windows */}
      <WindowGrid cols={3} rows={6} offsetX={0} offsetY={0.18} offsetZ={0.33} spacing={0.24} vSpacing={0.28} mat={windowMat} />
      {/* Main tower — back windows */}
      <WindowGrid cols={3} rows={6} offsetX={0} offsetY={0.18} offsetZ={-0.33} spacing={0.24} vSpacing={0.28} mat={windowDarkMat} />

      {/* ── Left Wing ── */}
      <mesh position={[-0.72, 0.4, 0]} material={wingMat} castShadow>
        <boxGeometry args={[0.55, 0.85, 0.55]} />
      </mesh>
      <mesh position={[-0.72, 0.845, 0]} material={roofMat}>
        <boxGeometry args={[0.57, 0.05, 0.57]} />
      </mesh>
      <WindowGrid cols={2} rows={3} offsetX={-0.72} offsetY={0.1} offsetZ={0.28} spacing={0.2} vSpacing={0.22} mat={windowMat} />

      {/* ── Right Wing ── */}
      <mesh position={[0.72, 0.4, 0]} material={wingMat} castShadow>
        <boxGeometry args={[0.55, 0.85, 0.55]} />
      </mesh>
      <mesh position={[0.72, 0.845, 0]} material={roofMat}>
        <boxGeometry args={[0.57, 0.05, 0.57]} />
      </mesh>
      <WindowGrid cols={2} rows={3} offsetX={0.72} offsetY={0.1} offsetZ={0.28} spacing={0.2} vSpacing={0.22} mat={windowMat} />

      {/* ── Lobby Base ── */}
      <mesh position={[0, -0.08, 0.35]} material={stoneMat} castShadow>
        <boxGeometry args={[0.55, 0.22, 0.25]} />
      </mesh>

      {/* ── Ground base plate ── */}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <boxGeometry args={[1.8, 0.04, 1.0]} />
        <meshStandardMaterial color="#DDD6CC" roughness={0.8} />
      </mesh>
    </group>
  );
}

/* ─── Scene ─── */
function HotelScene() {
  return (
    <>
      <ambientLight intensity={1.2} color="#FFF5E8" />
      <directionalLight
        position={[4, 6, 3]}
        intensity={2.0}
        color="#FFFFFF"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#D1FAE5" />
      <pointLight position={[0, 3, 2]} intensity={0.4} color="#FDE68A" />
      <Environment preset="city" />
      <HotelBuilding />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={false}
        dampingFactor={0.08}
        enableDamping
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.8}
      />
    </>
  );
}

/* ─── Spinner fallback ─── */
function CanvasSpinner() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-stone-200 border-t-emerald-500 animate-spin" />
    </div>
  );
}

/* ─── Export (dynamic, no SSR) ─── */
function HotelModel3DInner() {
  return (
    <div className="h-full w-full">
      <Suspense fallback={<CanvasSpinner />}>
        <Canvas
          camera={{ position: [2.2, 1.4, 2.8], fov: 42 }}
          gl={{ antialias: true, alpha: true }}
          shadows
          style={{ background: "transparent" }}
        >
          <HotelScene />
        </Canvas>
      </Suspense>
    </div>
  );
}

export const HotelModel3D = dynamic(
  () => Promise.resolve(HotelModel3DInner),
  { ssr: false, loading: () => <CanvasSpinner /> }
);
