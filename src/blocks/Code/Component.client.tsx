'use client'
import { Highlight, themes } from 'prism-react-renderer'
import React from 'react'

import { CopyButton } from '@/components/research/Copy.client'

/* Code in the K7 prose: a mono block on the code ground with a head that names the language and copies it. */
export const Code: React.FC<{ code: string; language?: string }> = ({ code, language = 'text' }) => {
  if (!code) return null
  return (
    <>
      <div className="code-head label">
        <span>{language === 'text' ? 'Code' : language}</span>
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
    </>
  )
}
