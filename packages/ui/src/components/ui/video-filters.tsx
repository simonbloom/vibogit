export function MatrixVideoFilter() {
  return (
    <svg className="hidden" width="0" height="0">
      <defs>
        <filter id="matrix-video-filter" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.33 0.33 0.33 0 0
                    0.33 0.33 0.33 0 0
                    0.33 0.33 0.33 0 0
                    0    0    0    1 0"
            result="grayscale"
          />
          <feComponentTransfer in="grayscale">
            <feFuncR type="table" tableValues="0 0.051" />
            <feFuncG type="table" tableValues="1 0.051" />
            <feFuncB type="table" tableValues="0.25 0.051" />
            <feFuncA type="identity" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

export function DarkModeVideoFilter() {
  return (
    <svg className="hidden" width="0" height="0">
      <defs>
        <filter id="dark-mode-video-filter" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.33 0.33 0.33 0 0
                    0.33 0.33 0.33 0 0
                    0.33 0.33 0.33 0 0
                    0    0    0    1 0"
            result="grayscale"
          />
          <feComponentTransfer in="grayscale">
            <feFuncR type="table" tableValues="1 0.06" />
            <feFuncG type="table" tableValues="1 0.09" />
            <feFuncB type="table" tableValues="1 0.16" />
            <feFuncA type="identity" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

export function EmberVideoFilter() {
  return (
    <svg className="hidden" width="0" height="0">
      <defs>
        <filter id="ember-video-filter" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.33 0.33 0.33 0 0
                    0.33 0.33 0.33 0 0
                    0.33 0.33 0.33 0 0
                    0    0    0    1 0"
            result="grayscale"
          />
          <feComponentTransfer in="grayscale">
            <feFuncR type="table" tableValues="0.5 0.1" />
            <feFuncG type="table" tableValues="0.5 0.1" />
            <feFuncB type="table" tableValues="0.5 0.1" />
            <feFuncA type="identity" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
