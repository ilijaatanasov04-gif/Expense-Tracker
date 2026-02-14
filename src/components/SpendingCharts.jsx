import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export function SpendingCharts({ categoryChart, dateChart }) {
  return (
    <div className="charts-grid">
      <figure>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={categoryChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="total" fill="#0ea5e9" />
          </BarChart>
        </ResponsiveContainer>
      </figure>
      <figure>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dateChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </figure>
    </div>
  )
}

export default SpendingCharts
