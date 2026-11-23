import Icon from './Icon.jsx'

function MetricCard({ label, value, detail, icon, tone }) {
  return (
    <article className="metric-card">
      <div className={`metric-card__icon metric-card__icon--${tone}`}>
        <Icon name={icon} size={19} />
      </div>
      <p className="metric-card__label">{label}</p>
      <div className="metric-card__value-row">
        <strong className={value === null ? 'metric-card__value--unavailable' : ''}>
          {value ?? '—'}
        </strong>
      </div>
      <p className={`metric-card__detail${value === null ? ' metric-card__detail--muted' : ''}`}>
        {detail}
      </p>
    </article>
  )
}

export default MetricCard
