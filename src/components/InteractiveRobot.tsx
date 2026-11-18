import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type RobotState = 'idle' | 'username' | 'password' | 'success';

interface InteractiveRobotProps {
  state: RobotState;
}

export const InteractiveRobot: React.FC<InteractiveRobotProps> = ({ state }) => {
  // Common animation config
  const transition: any = { type: 'spring', stiffness: 120, damping: 15, mass: 0.8 };

  // Floating breathing effect for idle state
  const floatAnimation: any = state === 'success' 
    ? {
        y: [-10, 10, -10],
        transition: {
          duration: 0.6,
          repeat: Infinity,
          ease: 'easeInOut'
        }
      }
    : {
        y: [0, -8, 0],
        transition: {
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut'
        }
      };

  return (
    <motion.div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: 1000,
      }}
      animate={floatAnimation}
    >
      <svg
        width="300"
        height="350"
        viewBox="0 0 300 350"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'drop-shadow(0px 20px 30px rgba(0, 0, 0, 0.4))' }}
      >
        {/* Glow Filters */}
        <defs>
          <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2affff" stopOpacity="1" />
            <stop offset="100%" stopColor="#00c8c8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
          <linearGradient id="chestPlate" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="neonGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2affff" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Hover Shadow */}
        <motion.ellipse
          cx="150"
          cy="325"
          rx={state === 'success' ? 45 : 60}
          ry="10"
          fill="rgba(42, 255, 255, 0.15)"
          filter="url(#glow)"
          animate={{
            scale: state === 'success' ? [0.9, 1.1, 0.9] : [1, 0.9, 1],
            opacity: state === 'success' ? [0.6, 0.9, 0.6] : [0.8, 0.6, 0.8]
          }}
          transition={{
            duration: state === 'success' ? 0.6 : 3,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />

        {/* Jet Flame (Hover Engine) */}
        <motion.path
          d="M130 280 L150 315 L170 280 Z"
          fill="url(#neonGlow)"
          opacity="0.85"
          filter="url(#glow)"
          animate={{
            scaleY: state === 'success' ? [1.2, 1.8, 1.2] : [1, 1.3, 1],
            scaleX: state === 'success' ? [1.1, 0.9, 1.1] : [1, 1.1, 1],
          }}
          transition={{
            duration: 0.15,
            repeat: Infinity,
            ease: 'linear'
          }}
          style={{ transformOrigin: '150px 280px' }}
        />

        {/* ROBOT BODY / TORSO */}
        <motion.g
          animate={{
            rotateY: state === 'username' ? 8 : state === 'password' ? -8 : 0,
            x: state === 'username' ? 5 : state === 'password' ? -5 : 0,
          }}
          transition={transition}
          style={{ transformOrigin: '150px 210px' }}
        >
          {/* Main Body Chassis */}
          <rect
            x="100"
            y="170"
            width="100"
            height="110"
            rx="25"
            fill="url(#bodyGrad)"
            stroke="url(#neonGlow)"
            strokeWidth="2.5"
          />

          {/* Chest Plate Detail */}
          <rect
            x="112"
            y="182"
            width="76"
            height="65"
            rx="15"
            fill="url(#chestPlate)"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1.5"
          />

          {/* Heartbeat Core */}
          <motion.circle
            cx="150"
            cy="215"
            r="16"
            fill="rgba(42, 255, 255, 0.15)"
            stroke="#2affff"
            strokeWidth="2"
            filter="url(#glow)"
            animate={{
              scale: state === 'success' ? [1, 1.3, 1] : [1, 1.15, 1],
              opacity: state === 'success' ? [0.8, 1, 0.8] : [0.5, 0.8, 0.5]
            }}
            transition={{
              duration: state === 'success' ? 0.4 : 1.2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />
          {/* Pulse wave line inside Core */}
          <path
            d="M140 215 H146 L148 208 L151 222 L153 213 L155 215 H160"
            stroke="#2affff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.g>

        {/* LEFT ARM */}
        <motion.g
          animate={
            state === 'password'
              ? { rotate: 125, x: 28, y: -45 }
              : state === 'success'
              ? { rotate: [135, 105, 135], x: 0, y: 0 }
              : { rotate: -15, x: 0, y: 0 }
          }
          transition={state === 'success' ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } : transition}
          style={{ transformOrigin: '95px 185px' }}
        >
          {/* Shoulder Joint */}
          <circle cx="95" cy="185" r="10" fill="#3b82f6" stroke="#2affff" strokeWidth="1.5" />
          {/* Arm limb */}
          <rect x="87" y="195" width="16" height="60" rx="8" fill="url(#bodyGrad)" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1.5" />
          {/* Glowing stripes */}
          <line x1="90" y1="215" x2="100" y2="215" stroke="#2affff" strokeWidth="2" />
          <line x1="90" y1="230" x2="100" y2="230" stroke="#2affff" strokeWidth="2" />
          {/* Hand clamp */}
          <path d="M85 260 Q95 272 105 260" stroke="#2affff" strokeWidth="3" fill="none" strokeLinecap="round" />
        </motion.g>

        {/* RIGHT ARM (Pointing Arm) */}
        <motion.g
          animate={
            state === 'username'
              ? { rotate: -85, x: -8, y: -10 }
              : state === 'password'
              ? { rotate: -125, x: -28, y: -45 }
              : state === 'success'
              ? { rotate: [-135, -105, -135], x: 0, y: 0 }
              : { rotate: 15, x: 0, y: 0 }
          }
          transition={state === 'success' ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } : transition}
          style={{ transformOrigin: '205px 185px' }}
        >
          {/* Shoulder Joint */}
          <circle cx="205" cy="185" r="10" fill="#3b82f6" stroke="#2affff" strokeWidth="1.5" />
          {/* Arm limb */}
          <rect x="197" y="195" width="16" height="60" rx="8" fill="url(#bodyGrad)" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1.5" />
          {/* Glowing stripes */}
          <line x1="200" y1="215" x2="210" y2="215" stroke="#2affff" strokeWidth="2" />
          <line x1="200" y1="230" x2="210" y2="230" stroke="#2affff" strokeWidth="2" />
          {/* Hand clamp / pointer finger */}
          {state === 'username' ? (
            // Pointing finger gesture
            <g>
              <path d="M198 260 Q205 275 212 260" stroke="#2affff" strokeWidth="3" fill="none" />
              <line x1="205" y1="262" x2="218" y2="262" stroke="#2affff" strokeWidth="3.5" strokeLinecap="round" filter="url(#glow)" />
            </g>
          ) : (
            <path d="M195 260 Q205 272 215 260" stroke="#2affff" strokeWidth="3" fill="none" strokeLinecap="round" />
          )}
        </motion.g>

        {/* HEAD ASSEMBLY (NECK + HEAD + EARS + ANTENNA) */}
        <motion.g
          animate={
            state === 'username'
              ? { rotateY: 22, rotateZ: 2, x: 12, y: 3 }
              : state === 'password'
              ? { rotateY: -28, rotateZ: -6, x: -12, y: 4 }
              : state === 'success'
              ? { rotateZ: [0, -5, 5, 0], y: [-3, 3, -3] }
              : { rotateY: 0, rotateZ: 0, x: 0, y: 0 }
          }
          transition={state === 'success' ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' } : transition}
          style={{ transformOrigin: '150px 145px' }}
        >
          {/* Neck connection */}
          <rect x="138" y="145" width="24" height="15" rx="4" fill="#334155" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <line x1="144" y1="150" x2="156" y2="150" stroke="#2affff" strokeWidth="2" />
          <line x1="144" y1="155" x2="156" y2="155" stroke="#2affff" strokeWidth="2" />

          {/* Antenna stem */}
          <line x1="150" y1="75" x2="150" y2="40" stroke="#475569" strokeWidth="3" />
          <line x1="150" y1="70" x2="150" y2="45" stroke="#2affff" strokeWidth="1.5" />
          {/* Antenna tip glowing ball */}
          <motion.circle
            cx="150"
            cy="36"
            r="7"
            fill="#2affff"
            stroke="#6366f1"
            strokeWidth="1.5"
            filter="url(#glow)"
            animate={{
              scale: state === 'success' ? [1, 1.4, 1] : [1, 1.15, 1],
              opacity: state === 'success' ? [0.8, 1, 0.8] : [0.7, 1, 0.7]
            }}
            transition={{
              duration: state === 'success' ? 0.3 : 1.5,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          />

          {/* Ear Bolts */}
          <rect x="86" y="100" width="10" height="24" rx="3" fill="#475569" stroke="rgba(255,255,255,0.1)" />
          <rect x="204" y="100" width="10" height="24" rx="3" fill="#475569" stroke="rgba(255,255,255,0.1)" />

          {/* Main Helmet / Head */}
          <rect
            x="92"
            y="72"
            width="116"
            height="80"
            rx="32"
            fill="url(#bodyGrad)"
            stroke="url(#neonGlow)"
            strokeWidth="2.5"
          />

          {/* Screen Visor / Face */}
          <rect
            x="102"
            y="82"
            width="96"
            height="60"
            rx="22"
            fill="#090d16"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1.5"
          />

          {/* Visor Grid overlay (Cyber look) */}
          <path
            d="M102 95 H198 M102 110 H198 M102 125 H198 M120 82 V142 M140 82 V142 M160 82 V142 M180 82 V142"
            stroke="rgba(42, 255, 255, 0.03)"
            strokeWidth="1"
          />

          {/* EYES (ANIMATED SCREEN DISPLAY) */}
          <g>
            <AnimatePresence mode="wait">
              {state === 'success' ? (
                // Happy Arc Eyes (^ ^)
                <motion.g
                  key="success-eyes"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <path
                    d="M120 115 L130 102 L140 115"
                    stroke="#2affff"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow)"
                  />
                  <path
                    d="M160 115 L170 102 L180 115"
                    stroke="#2affff"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="url(#glow)"
                  />
                </motion.g>
              ) : state === 'username' ? (
                // Pointing/Looking focused eyes, shifted right
                <motion.g
                  key="username-eyes"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <ellipse cx="138" cy="110" rx="10" ry="12" fill="#2affff" filter="url(#glow)" />
                  <circle cx="140" cy="110" r="4" fill="#090d16" />
                  
                  <ellipse cx="174" cy="110" rx="10" ry="12" fill="#2affff" filter="url(#glow)" />
                  <circle cx="176" cy="110" r="4" fill="#090d16" />
                </motion.g>
              ) : state === 'password' ? (
                // Closed/Covered sleeping eyes
                <motion.g
                  key="password-eyes"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <path d="M122 110 Q132 120 142 110" stroke="#2affff" strokeWidth="3" fill="none" strokeLinecap="round" filter="url(#glow)" />
                  <path d="M158 110 Q168 120 178 110" stroke="#2affff" strokeWidth="3" fill="none" strokeLinecap="round" filter="url(#glow)" />
                </motion.g>
              ) : (
                // Idle breathing/blinking eyes
                <motion.g
                  key="idle-eyes"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Left Eye */}
                  <motion.ellipse
                    cx="132"
                    cy="110"
                    rx="8"
                    ry="8"
                    fill="#2affff"
                    filter="url(#glow)"
                    animate={{
                      scaleY: [1, 1, 1, 1, 0.1, 1, 1, 1],
                    }}
                    transition={{
                      duration: 3.5,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                  />
                  
                  {/* Right Eye */}
                  <motion.ellipse
                    cx="168"
                    cy="110"
                    rx="8"
                    ry="8"
                    fill="#2affff"
                    filter="url(#glow)"
                    animate={{
                      scaleY: [1, 1, 1, 1, 0.1, 1, 1, 1],
                    }}
                    transition={{
                      duration: 3.5,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                  />
                </motion.g>
              )}
            </AnimatePresence>
          </g>
        </motion.g>
      </svg>
    </motion.div>
  );
};
