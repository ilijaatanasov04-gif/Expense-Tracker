export function AlertBox({ alert }) {
  return <section className={`flash flash-${alert.type}`}>{alert.message}</section>
}
