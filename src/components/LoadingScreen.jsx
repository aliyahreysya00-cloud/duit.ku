import Mascot from './Mascot'

export default function LoadingScreen({ message = 'Bentar ya, lagi ngitung...' }) {
  return (
    <div className="loading-screen" role="status" aria-label={message}>
      <div className="loading-screen__mascot">
        <Mascot mood="neutral" size={80} />
      </div>
      <p className="loading-screen__text">{message}</p>
      <div className="loading-screen__dots" aria-hidden="true">
        <span /><span /><span />
      </div>
    </div>
  )
}
