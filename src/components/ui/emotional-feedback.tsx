// Componente de animaciones emocionales para eventos importantes
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// @ts-ignore
import confetti from 'canvas-confetti';
import { CheckCircle, MagicStar, Sparkles, Heart, CreditCard, ShoppingBag, Star, Trophy } from 'reicon-react';

interface EmotionalFeedbackProps {
  type: 'sale' | 'payment' | 'credit_approved' | 'order' | 'milestone';
  message?: string;
  onComplete?: () => void;
}

export function EmotionalFeedback({ type, message, onComplete }: EmotionalFeedbackProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Disparar confetti para eventos especiales
    if (type === 'payment' || type === 'milestone') {
      const duration = 2000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#D4AF37', '#FFD700', '#FFA500']
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#D4AF37', '#FFD700', '#FFA500']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    } else if (type === 'sale' || type === 'order') {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10B981', '#34D399', '#6EE7B7']
      });
    } else if (type === 'credit_approved') {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#8B5CF6', '#A78BFA', '#C4B5FD']
      });
    }

    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 3000);

    return () => clearTimeout(timer);
  }, [type, onComplete]);

  const getConfig = () => {
    switch (type) {
      case 'sale':
        return {
          icon: <ShoppingBag className="h-8 w-8" />,
          title: '¡Venta Confirmada!',
          subtitle: message || '¡Excelente trabajo! 💪',
          color: 'from-green-500 to-emerald-600',
          emoji: '🎉'
        };
      case 'payment':
        return {
          icon: <CreditCard className="h-8 w-8" />,
          title: '¡Pago Recibido!',
          subtitle: message || 'Gracias por pagar a tiempo 🙌',
          color: 'from-blue-500 to-indigo-600',
          emoji: '💰'
        };
      case 'credit_approved':
        return {
          icon: <Sparkles className="h-8 w-8" />,
          title: '¡Crédito Aprobado!',
          subtitle: message || 'Bienvenido al sistema de crédito ✨',
          color: 'from-purple-500 to-pink-600',
          emoji: '🌟'
        };
      case 'order':
        return {
          icon: <CheckCircle className="h-8 w-8" />,
          title: '¡Pedido Realizado!',
          subtitle: message || 'Tu pedido está en proceso 📦',
          color: 'from-gold to-amber-500',
          emoji: '🛒'
        };
      case 'milestone':
        return {
          icon: <Trophy className="h-8 w-8" />,
          title: '¡Felicitaciones!',
          subtitle: message || 'Has alcanzado un nuevo logro 🏆',
          color: 'from-gold via-yellow-400 to-amber-500',
          emoji: '🎊'
        };
      default:
        return {
          icon: <Star className="h-8 w-8" />,
          title: '¡Genial!',
          subtitle: message || '',
          color: 'from-gray-500 to-gray-600',
          emoji: '✨'
        };
    }
  };

  const config = getConfig();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: -50 }}
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
        >
          <motion.div
            initial={{ rotate: -10 }}
            animate={{ rotate: [0, -5, 5, -5, 0] }}
            transition={{ duration: 0.5 }}
            className={`bg-gradient-to-br ${config.color} text-white rounded-3xl p-8 shadow-2xl max-w-sm mx-4`}
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: 2 }}
              className="flex justify-center mb-4"
            >
              <div className="p-4 bg-white/20 rounded-full">
                {config.icon}
              </div>
            </motion.div>
            
            <div className="text-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <span className="text-4xl">{config.emoji}</span>
              </motion.div>
              
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold mt-2"
              >
                {config.title}
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-white/90 mt-2"
              >
                {config.subtitle}
              </motion.p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook para usar las animaciones emocionales
export function useEmotionalFeedback() {
  const [feedback, setFeedback] = useState<{
    type: EmotionalFeedbackProps['type'];
    message?: string;
  } | null>(null);

  const showFeedback = (type: EmotionalFeedbackProps['type'], message?: string) => {
    setFeedback({ type, message });
  };

  const clearFeedback = () => {
    setFeedback(null);
  };

  const FeedbackComponent = feedback ? (
    <EmotionalFeedback
      type={feedback.type}
      message={feedback.message}
      onComplete={clearFeedback}
    />
  ) : null;

  return { showFeedback, clearFeedback, FeedbackComponent };
}
