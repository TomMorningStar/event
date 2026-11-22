import { SIGN, SIGN_BOX } from './signPaths.js'

const toOrigin = `translate(${-SIGN_BOX.x} ${-SIGN_BOX.y})`

/**
 * Фирменный фон по брендбуку: тонкий узор из контуров знака,
 * крупный знак, обрезанный правым краем экрана, и лаймовый лист в углу.
 */
export default function Backdrop() {
  return (
    <div className="vd-backdrop" aria-hidden>
      <svg className="vd-backdrop-tile" width="100%" height="100%">
        <defs>
          <pattern id="vd-tile" width="96" height="88" patternUnits="userSpaceOnUse">
            <path
              d={SIGN.outline}
              transform={`translate(17 16) scale(1.6) ${toOrigin}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#vd-tile)" />
      </svg>

      <svg className="vd-backdrop-sign" viewBox={`0 0 ${SIGN_BOX.w} ${SIGN_BOX.h}`}>
        <g transform={toOrigin}>
          <path className="vd-bs-outline" d={SIGN.outline} />
          <path className="vd-bs-leaf" d={SIGN.leafL} />
          <path className="vd-bs-leaf" d={SIGN.leafR} />
        </g>
      </svg>

      <svg className="vd-backdrop-leaf" viewBox="0 0 400 400">
        <path d="M0 400C30 190 190 30 400 0C370 210 210 370 0 400Z" />
      </svg>
    </div>
  )
}
