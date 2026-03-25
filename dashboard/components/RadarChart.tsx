'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface DimensionData {
  name: string;
  score: number;
}

interface Props {
  dimensions: DimensionData[];
  title?: string;
}

export default function RadarChartComponent({ dimensions, title = '五维评估' }: Props) {
  const data = dimensions.map((d) => ({
    subject: d.name,
    score: d.score,
    fullMark: 100,
  }));

  return (
    <div className="card">
      {title && <div className="card-header">{title}</div>}
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="#2a2a3a" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#8a8aaa', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: '#5a5a7a', fontSize: 10 }}
          />
          <Radar
            name="评分"
            dataKey="score"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.25}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              background: '#1a1a25',
              border: '1px solid #2a2a3a',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
