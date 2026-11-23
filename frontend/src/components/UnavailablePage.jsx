import Icon from './Icon.jsx'

function UnavailablePage({ title, description, dependency, onBack }) {
  return (
    <section className="unavailable-page" aria-labelledby="unavailable-title">
      <span className="unavailable-page__icon"><Icon name="lock" size={23} /></span>
      <p className="eyebrow">NOT CONNECTED</p>
      <h2 id="unavailable-title">{title}</h2>
      <p className="unavailable-page__description">{description}</p>
      <div className="unavailable-page__dependency">
        <strong>Integration status</strong>
        <span>{dependency}</span>
      </div>
      <button className="button button--secondary" type="button" onClick={onBack}>
        Return to dashboard
      </button>
    </section>
  )
}

export default UnavailablePage
