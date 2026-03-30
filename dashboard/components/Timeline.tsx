'use client';

import { SessionStep } from '@/lib/mock-data';

interface Props {
  steps: SessionStep[];
}

const stepIcons: Record<string, string> = {
  reasoning: '🧠',
  tool_call: '🔧',
  response: '💬',
  observation: '👁️',
};

const stepColors: Record<string, string> = {
  reasoning: 'border-accent-purple bg-accent-purple/10',
  tool_call: 'border-accent-cyan bg-accent-cyan/10',
  response: 'border-accent-green bg-accent-green/10',
  observation: 'border-accent-yellow bg-accent-yellow/10',
};

const stepLabels: Record<string, string> = {
  reasoning: '推理过程',
  tool_call: '工具调用',
  response: '响应输出',
  observation: '观察结果',
};

export default function Timeline({ steps }: Props) {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={step.id} className="flex gap-4">
          {/* Timeline line */}
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full border-2 ${stepColors[step.type]} flex items-center justify-center text-lg flex-shrink-0`}
            >
              {stepIcons[step.type]}
            </div>
            {index < steps.length - 1 && (
              <div className="w-0.5 flex-1 bg-dark-600 mt-2" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-medium text-white">
                {stepLabels[step.type]}
              </span>
              {step.redacted && (
                <span className="badge badge-critical text-xs">
                  🔒 已脱敏
                </span>
              )}
              {step.duration && (
                <span className="text-xs text-dark-300">
                  耗时: {step.duration}
                </span>
              )}
              <span className="text-xs text-dark-400 ml-auto">
                {new Date(step.timestamp).toLocaleTimeString('zh-CN')}
              </span>
            </div>

            <div className="card !p-4">
              <p className="text-sm text-dark-100 leading-relaxed">
                {step.content}
              </p>

              {step.toolName && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-dark-700 px-2 py-1 rounded text-accent-cyan">
                      {step.toolName}
                    </span>
                  </div>

                  {step.toolInput && (
                    <div>
                      <p className="text-xs text-dark-300 mb-1">入参:</p>
                      <pre className="text-xs bg-dark-900 p-3 rounded-lg overflow-x-auto text-dark-100 border border-dark-600">
                        {step.toolInput}
                      </pre>
                    </div>
                  )}

                  {step.toolOutput && (
                    <div>
                      <p className="text-xs text-dark-300 mb-1">返回:</p>
                      <pre className="text-xs bg-dark-900 p-3 rounded-lg overflow-x-auto text-dark-100 border border-dark-600">
                        {step.toolOutput}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
