import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

/*
 * HoverLine for axis hover
 *
 * @class HoverLine
 * @extends PureComponent
 */
class HoverLine extends PureComponent {
  render() {
    let {
      width,
      isTimelineDragging,
      isAnimationDraggerDragging,
      showHoverLine,
      hoverLinePosition
    } = this.props;
    // check for timeline/animation dragging and showhover handled by parent
    let showHover = !isTimelineDragging && !isAnimationDraggerDragging && showHoverLine;
    return (
      showHover
        ? <svg className='timeline-hover-line-container' width={width} height={63}>
          <line className='timeline-hover-line'
            stroke='blue' strokeWidth='2' strokeOpacity='0.48' x1='0' x2='0' y1='0' y2='63'
            transform={`translate(${hoverLinePosition + 1}, 0)`}
          />
        </svg>
        : null
    );
  }
}

HoverLine.propTypes = {
  hoverLinePosition: PropTypes.number,
  isTimelineDragging: PropTypes.bool,
  showHoverLine: PropTypes.bool
};

export default HoverLine;
