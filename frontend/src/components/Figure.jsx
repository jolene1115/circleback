import React, {useEffect, useRef, useState} from 'react';

import {figureStateLabel, getFigureState, mountFigure, onFigureState, setFigureScene, setFigureState} from '../engine/figure.js';

/** The animated interviewer on the home and setup pages. */
export default function Figure({view}) {
  const canvas = useRef(null);
  const [state, setState] = useState(getFigureState);
  useEffect(() => onFigureState(setState), []);
  useEffect(() => {
    setFigureScene({view, immersive: false});
    setFigureState('listening');
    return mountFigure(canvas.current, {greet: true});
  }, [view]);
  return (
    <div className="moon-stage">
      <canvas ref={canvas} className="moon-canvas" width="1000" height="500" aria-label="Animated line interviewer" />
      <div className="moon-caption">
        <span id="moonStatus">{figureStateLabel(state)}</span>
      </div>
    </div>
  );
}
