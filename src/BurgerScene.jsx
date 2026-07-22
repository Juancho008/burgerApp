import { ContactShadows, Environment, Lightformer, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { enhanceBurgerMaterials } from './burgerTextures'

// Modelo generado proceduralmente con Blender (tools/burger_blender.py).
// Alto ~2.22 unidades (eje Y), ancho ~2.9; la base apoya en y=0.
const MODEL_HEIGHT = 2.22
const MODEL_WIDTH = 2.95
const MODEL_CENTER_Y = 1.1

function BurgerModel({ lowPower = false }) {
  const { scene } = useGLTF('/burger.glb')

  useEffect(() => {
    enhanceBurgerMaterials(scene, { resolution: lowPower ? 256 : 512 })

    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((material) => {
          if (material) material.envMapIntensity = 1.05
        })
      }
    })
  }, [scene, lowPower])

  return <primitive object={scene} position={[0, -MODEL_CENTER_Y, 0]} />
}

useGLTF.preload('/burger.glb')

export default function BurgerScene({ scrollProgress, lowPower = false, onReady }) {
  const groupRef = useRef()
  const readyNotified = useRef(false)
  const { viewport } = useThree()

  const isNarrow = viewport.width < 7
  const scale = isNarrow
    ? Math.min((viewport.height * 0.42) / MODEL_HEIGHT, (viewport.width * 0.88) / MODEL_WIDTH)
    : Math.min((viewport.height * 0.62) / MODEL_HEIGHT, (viewport.width * 0.44) / MODEL_WIDTH)
  const targetX = isNarrow ? 0 : viewport.width * 0.21

  useFrame((state, delta) => {
    // Este componente queda suspendido hasta que el GLB termina de cargar, así que
    // el primer frame que se dibuja ya incluye la hamburguesa completa.
    if (!readyNotified.current) {
      readyNotified.current = true
      onReady?.()
    }

    const group = groupRef.current
    if (!group) return

    const progress = scrollProgress.current
    const targetRotation = progress * Math.PI * 2.2 + state.clock.elapsedTime * 0.06

    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, targetRotation, 4, delta)
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, -0.02 + progress * 0.22, 3, delta)
    group.position.x = THREE.MathUtils.damp(group.position.x, targetX, 3, delta)
    group.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.07
  })

  return (
    <>
      <ambientLight intensity={lowPower ? 0.8 : 0.55} color="#ffe8cf" />
      <directionalLight
        position={[4.5, 6, 6]}
        intensity={2.6}
        color="#fff1d8"
        castShadow={!lowPower}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-5.5, 2, 2.5]} intensity={1.1} color="#ff8a4a" />
      <pointLight position={[0, -3.5, 4.5]} intensity={5} color="#d84315" distance={14} />

      <group ref={groupRef} scale={scale} position={[targetX, 0, 0]}>
        <BurgerModel lowPower={lowPower} />
      </group>

      <ContactShadows
        position={[targetX, -MODEL_CENTER_Y * scale - 0.25, 0]}
        opacity={0.55}
        scale={MODEL_WIDTH * scale * 2.4}
        blur={2.4}
        far={4}
        resolution={lowPower ? 256 : 512}
        frames={lowPower ? 1 : Infinity}
        color="#190701"
      />

      {!lowPower && (
        <Environment resolution={256} frames={1}>
          <Lightformer intensity={1.6} position={[5, 4, 4]} scale={[7, 7, 1]} color="#fff3dd" />
          <Lightformer
            intensity={1.1}
            position={[-6, 2, -3]}
            rotation-y={Math.PI / 2.4}
            scale={[6, 6, 1]}
            color="#ff9048"
          />
          <Lightformer form="ring" intensity={0.8} position={[0, -4, 3]} scale={[9, 4, 1]} color="#ffd9a3" />
        </Environment>
      )}
    </>
  )
}
