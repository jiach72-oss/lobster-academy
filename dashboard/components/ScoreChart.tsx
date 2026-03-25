'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { scoreHistory } from '@/lib/mock-data';

const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function ScoreChart() {
  return (
    <div className="card">
      <div className="card-header">安全评分趋势</div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={scoreHistory}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="date"
            stroke="#5a5a7a"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke="#5a5a7a"
            fontSize={12}
            tickLine={false}
            domain={[60, 100]}
          />
          <Tooltip
            contentStyle={{
              background: '#1a1a25',
              border: '1px solid #2a2a3a',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
          />
          <Line type="monotone" dataKey="CodeAssist Pro" stroke={colors[0]} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="DataAnalyst Bot" stroke={colors[1]} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="CustomerSupport AI" stroke={colors[2]} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="SecurityScanner" stroke={colors[3]} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="WritingAssistant" stroke={colors[4]} strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
