/**
 * AngelaMascot — Representación visual animada de Ángela (mascota rosa de Manojitos).
 *
 * Reutiliza el asset existente del repositorio (src/assets/stitch-rosa-mascot.png)
 * — una criatura rosa de orejas y ojos grandes — y le da un acabado tipo 3D con
 * un "pod" de luz suave, sombra de contacto y animaciones fluidas con
 * framer-motion (ya presente en el proyecto; sin dependencias nuevas ni motor 3D).
 *
 * El sprite es un JPEG con fondo blanco: se integra con `mix-blend-mode: multiply`
 * sobre el fondo claro del pod, de modo que el blanco desaparece y solo se ve la
 * criatura, sin necesidad de procesar la imagen.
 *
 * Puramente presentacional: no conoce el backend ni ninguna secret.
 */
import { motion, useReducedMotion, type Variants } from "framer-motion";
import mascotUrl from "@/assets/stitch-rosa-mascot.png";
import { cn } from "@/lib/utils";

export type MascotState = "idle" | "thinking" | "happy";

interface AngelaMascotProps {
  /** Diámetro del pod en px. */
  size?: number;
  state?: MascotState;
  /** Anima la entrada (aparición con "pop"). */
  entrance?: boolean;
  className?: string;
}

// Movimiento continuo del sprite por estado. El "squash" de scaleY en idle es un
// guiño de vida sutil (la imagen es un raster con ojos fijos, así que animamos el
// sprite completo en lugar de párpados individuales).
const spriteVariants: Variants = {
  idle: {
    y: [0, -5, 0],
    rotate: [0, -2.5, 0, 2.5, 0],
    scaleY: [1, 1, 0.95, 1, 1],
    transition: { duration: 4.5, ease: "easeInOut", repeat: Infinity },
  },
  thinking: {
    y: [0, -3, 0],
    rotate: [0, -1.5, 1.5, 0],
    transition: { duration: 0.9, ease: "easeInOut", repeat: Infinity },
  },
  happy: {
    scale: [1, 1.16, 0.96, 1],
    rotate: [0, -7, 7, 0],
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

export default function AngelaMascot({
  size = 72,
  state = "idle",
  entrance = false,
  className,
}: AngelaMascotProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full",
        className,
      )}
      style={{ width: size, height: size }}
      initial={entrance ? { scale: 0, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      {/* Pod de luz suave: fondo claro que da el acabado 3D y hace de lienzo para
          el blend multiply. Rosa muy tenue -> blanco en el centro. */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, #ffffff 0%, #fff1f5 58%, #ffe1ea 100%)",
          boxShadow:
            "inset 0 2px 6px rgba(255,255,255,0.9), 0 6px 16px -4px rgba(196,96,122,0.45)",
        }}
      />

      {/* Sprite de Ángela */}
      <motion.img
        src={mascotUrl}
        alt="Ángela"
        draggable={false}
        width={size}
        height={size}
        className="relative select-none"
        style={{
          width: "88%",
          height: "88%",
          objectFit: "contain",
          mixBlendMode: "multiply",
          filter: "drop-shadow(0 3px 4px rgba(120,40,70,0.28))",
        }}
        variants={reduce ? undefined : spriteVariants}
        animate={reduce ? undefined : state}
      />
    </motion.div>
  );
}
