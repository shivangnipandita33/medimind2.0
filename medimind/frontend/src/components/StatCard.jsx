export default function StatCard({ label, value, icon: Icon, tone }) {
  return (
    <div className={`card stat stat-${tone}`}>
      <div className="stat-icon" aria-hidden="true">
        <Icon size={22} />
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}
