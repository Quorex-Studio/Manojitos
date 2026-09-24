/**
 * AngelaMascot — Avatar animado de la asistente virtual.
 *
 * Usa el isotipo oficial de la marca (crema) sobre un círculo del color principal
 * (vino), igual que el perfil de Instagram de EINA. La guía de marca prohíbe recolorear
 * el logo o aplicarle degradados, así que solo se anima la posición/escala.
 *
 * Puramente presentacional: no conoce el backend ni ninguna secret.
 */
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { BRAND_MASCOT as mascotUrl } from "@/config/brand-assets";
import { BRAND } from "@/config/brand";
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

// Movimiento del isotipo por estado: flotación suave en reposo, pulso al pensar
// y un pequeño salto de alegría.
const spriteVariants: Variants = {
  idle: {
    y: [0, -2, 0],
    transition: { duration: 4, ease: "easeInOut", repeat: Infinity },
  },
  thinking: {
    scale: [1, 0.92, 1],
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
      {/* Círculo de marca (vino) */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-primary shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.6)] ring-2 ring-background"
      />

      {/* Isotipo de la marca */}
      <motion.img
        src={mascotUrl}
        alt={BRAND.assistantName}
        draggable={false}
        width={size}
        height={size}
        className="relative select-none"
        style={{ width: "46%", height: "58%", objectFit: "contain" }}
        variants={reduce ? undefined : spriteVariants}
        animate={reduce ? undefined : state}
      />
    </motion.div>
  );
}
