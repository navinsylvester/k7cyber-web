'use client'
import { Highlight, themes } from 'prism-react-renderer'
import React from 'react'

import { CopyButton } from '@/components/research/Copy.client'

/* Code in the K7 prose: filed on the code ground (S7); the tab names the language and the length, and copies it. */
export const Code: React.FC<{ code: string; language?: string }> = ({ code, language = 'text' }) => {
  if (!code) return null
  const lines = code.replace(/\n$/, '').split('\n').length
  return (
    <div className="code filed">
      <div className="ftab label">
        <span>
          {language === 'text' ? 'Code' : language} · {String(lines).padStart(2, '0')} {lines === 1 ? 'line' : 'lines'}
        </span>
        <CopyButton text={code} className="textbtn" />
      </div>
      <Highlight code={code} language={language === 'text' ? 'plain' : language} theme={themes.vsDark}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre style={{ background: 'var(--code)' }}>
            <code>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} style={{ color: 'inherit' }} />
                  ))}
                </div>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
    </div>
  )
}
