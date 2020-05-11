/* eslint no-nested-ternary: 0 */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { datesinDateRanges } from '../../../modules/layers/util';
import util from '../../../util/util';
import {
  timeScaleToNumberKey,
} from '../../../modules/date/constants';
import DataItemContainer from './data-item-container';

// ignore multiple date ranges due to WV config not building to
// handle varying periods in same layer (example: M and D)
const ignoredLayer = {
  GRACE_Tellus_Liquid_Water_Equivalent_Thickness_Mascon_CRI: true,
};

/*
 * Layer Data Container for layer coverage.
 *
 * @class LayerDataItems
 */
class LayerDataItems extends Component {
  constructor(props) {
    super(props);

    // cache for queried date arrays
    this.layerDateArrayCache = {};
  }

  /**
  * @desc get layer header with title, subtitle, and full date range
  * @param {Object} layer
  * @param {Boolean} visible
  * @param {String} dateRange
  * @param {String} background color
  * @returns {DOM Element} header
  */
  getHeaderDOMEl = (layer, visible, dateRange, layerItemBackground) => {
    const titleColor = visible ? '#000' : '#999';
    const textColor = visible ? '#222' : '#999';
    const { subtitle, title } = layer;
    return (
      <>
        <div className="data-panel-layer-item-header">
          <div
            className="data-panel-layer-item-title"
            style={{
              color: titleColor,
            }}
          >
            {title}
            {' '}
            <span
              className="data-panel-layer-item-subtitle"
              style={{
                color: textColor,
              }}
            >
              {subtitle}
            </span>
          </div>
          <div
            className="data-panel-layer-item-date-range"
            style={{
              background: layerItemBackground,
              color: textColor,
            }}
          >
            {dateRange}
          </div>
        </div>
      </>
    );
  }

  /**
  * @desc get formatted time period name
  * @param {String} period
  * @returns {String} formatted period
  */
  getFormattedTimePeriod = (period) => (period === 'daily'
    ? 'day'
    : period === 'monthly'
      ? 'month'
      : period === 'yearly'
        ? 'year'
        : 'minute')

  /**
  * @desc get range date end with added interval based on period
  * @param {Object} range date object
  * @param {String} time unit period
  * @param {Number} itemRangeInterval
  * @param {Object} nextDate range object with date
  * @returns {Object} rangeDateEnd date object
  */
  getRangeDateEndWithAddedInterval = (rangeDate, layerPeriod, itemRangeInterval, nextDate) => {
    const { appNow } = this.props;
    const {
      minYear,
      minMonth,
      minDay,
      minHour,
      minMinute,
    } = util.getUTCNumbers(rangeDate, 'min');
    const yearAdd = layerPeriod === 'years' ? itemRangeInterval : 0;
    const monthAdd = layerPeriod === 'months' ? itemRangeInterval : 0;
    const dayAdd = layerPeriod === 'days' ? itemRangeInterval : 0;
    const hourAdd = layerPeriod === 'hours' ? itemRangeInterval : 0;
    const minuteAdd = layerPeriod === 'minutes' ? itemRangeInterval : 0;
    const rangeDateEndLocal = new Date(
      minYear + yearAdd,
      minMonth + monthAdd,
      minDay + dayAdd,
      minHour + hourAdd,
      minMinute + minuteAdd,
    );

    let rangeDateEnd = util.getTimezoneOffsetDate(rangeDateEndLocal);
    // check if next date cuts off this range
    // (e.g., 8 day interval with: currentDate = 12-27-1999, and nextDate = 1-1-2000)
    if (nextDate) {
      const nextDateObject = new Date(nextDate.date);
      const rangeDateEndTime = rangeDateEnd.getTime();
      const nextDateTime = nextDateObject.getTime();
      if (nextDateTime <= rangeDateEndTime) {
        rangeDateEnd = nextDateObject;
      }
    }
    // prevent range end exceeding appNow
    if (appNow < rangeDateEnd) {
      rangeDateEnd = appNow;
    }
    return rangeDateEnd;
  }

  /**
  * @desc get formatted, readable date range for header
  * @param {Object} layer
  * @returns {String} dateRangeText
  */
  getFormattedDateRange = (layer) => {
    // get start date -or- 'start'
    const { endDate, startDate } = layer;
    let dateRangeStart;
    if (startDate) {
      const yearMonthDaySplit = startDate.split('T')[0].split('-');
      const year = yearMonthDaySplit[0];
      const month = yearMonthDaySplit[1];
      const day = yearMonthDaySplit[2];

      const monthAbbrev = util.monthStringArray[Number(month) - 1];

      dateRangeStart = `${year} ${monthAbbrev} ${day}`;
    } else {
      dateRangeStart = 'Start';
    }

    // get end date -or- 'present'
    let dateRangeEnd;
    if (endDate) {
      const yearMonthDaySplit = endDate.split('T')[0].split('-');
      const year = yearMonthDaySplit[0];
      const month = yearMonthDaySplit[1];
      const day = yearMonthDaySplit[2];

      const monthAbbrev = util.monthStringArray[Number(month) - 1];

      dateRangeEnd = `${year} ${monthAbbrev} ${day}`;
    } else {
      dateRangeEnd = 'Present';
    }

    const dateRangeText = `${dateRangeStart} to ${dateRangeEnd}`;
    return dateRangeText;
  }

  /**
  * @desc get endDateLimit based on axis and appNow
  * @param {Boolean} layer inactive
  * @param {Boolean} isLastInRange
  * @returns {Object} endDateLimit date object
  */
  getMaxEndDate = (inactive, isLastInRange) => {
    const {
      appNow,
      backDate,
    } = this.props;

    let endDateLimit = new Date(backDate);
    const appNowDate = new Date(appNow);
    // appNow will override max range endDate
    if (appNowDate < endDateLimit) {
      endDateLimit = appNowDate;
    }
    // if last date of multiple ranges check for endDate over appNow date
    if (!inactive && isLastInRange) {
      if (endDateLimit > appNowDate) {
        endDateLimit = appNowDate;
      }
    }
    return endDateLimit;
  }

  /**
  * @desc get array of dates for layer
  * @param {Object} def - layer
  * @param {Object} range
  * @param {Object} endDateLimit
  * @param {Boolean} isLastInRange
  * @returns {Array} dateIntervalStartDates
  */
  getDatesInDateRange = (def, range, endDateLimit, isLastInRange) => {
    const {
      appNow,
      backDate,
      frontDate,
    } = this.props;

    const { period, id, inactive } = def;
    const { dateInterval, startDate, endDate } = range;

    const layerPeriod = this.getFormattedTimePeriod(period);
    const rangeInterval = Number(dateInterval);
    let rangeEnd;

    let startDateLimit = new Date(frontDate);
    // get leading start date minus rangeInterval and add to end date
    startDateLimit = moment.utc(startDateLimit).subtract(rangeInterval, layerPeriod);
    startDateLimit = moment(startDateLimit).toDate();
    rangeEnd = moment.utc(endDate).add(rangeInterval, layerPeriod);
    rangeEnd = moment(endDate).toDate();

    // rangeEnd for last time coverage section of active layers can't be greater than appNow
    const appNowDate = new Date(appNow);
    if (!inactive && isLastInRange) {
      rangeEnd = appNowDate;
    }

    // get dates within given date range
    let dateIntervalStartDates = [];
    const startLessThanOrEqualToEndDateLimit = new Date(startDate).getTime() <= endDateLimit.getTime();
    const endGreaterThanOrEqualToStartDateLimit = new Date(rangeEnd).getTime() >= startDateLimit.getTime();
    if (startLessThanOrEqualToEndDateLimit && endGreaterThanOrEqualToStartDateLimit) {
      // check layer date array cache and use caches date array if available, if not add date array
      if (!this.layerDateArrayCache[id]) {
        this.layerDateArrayCache[id] = {};
      }

      const layerIdDates = `${appNow.toISOString()}-${frontDate}-${backDate}`;
      if (this.layerDateArrayCache[id][layerIdDates] === undefined) {
        dateIntervalStartDates = datesinDateRanges(def, startDateLimit, startDateLimit, endDateLimit, appNow);
        this.layerDateArrayCache[id][layerIdDates] = dateIntervalStartDates;
      } else {
        dateIntervalStartDates = this.layerDateArrayCache[id][layerIdDates];
      }
    }
    return dateIntervalStartDates;
  }

  /**
  * @desc get conditional styling for layer container and coverage line
  * @param {Boolean} visible
  * @param {String} id
  * @returns {Object}
  *   @param {String} lineBackgroundColor
  *   @param {String} layerItemBackground
  *   @param {String} layerItemOutline
  */
  getLayerItemStyles = (visible, id) => {
    const { hoveredLayer } = this.props;
    // condtional styling for line/background colors
    const containerBackgroundColor = visible
      ? 'rgb(204, 204, 204)'
      : 'rgb(79, 79, 79)';
    // lighten data panel layer container on sidebar hover
    const containerHoveredBackgroundColor = visible
      ? 'rgb(230, 230, 230)'
      : 'rgb(101, 101, 101)';
    // layer coverage line color
    const lineBackgroundColor = visible
      ? 'rgb(0, 69, 123)'
      : 'rgb(116, 116, 116)';
    // check if provided id is hovered over for background color and outline
    const isLayerHoveredInSidebar = id === hoveredLayer;
    const layerItemBackground = isLayerHoveredInSidebar
      ? containerHoveredBackgroundColor
      : containerBackgroundColor;
    const layerItemOutline = isLayerHoveredInSidebar
      ? '1px solid rgb(204, 204, 204)'
      : '';

    return {
      lineBackgroundColor,
      layerItemBackground,
      layerItemOutline,
    };
  }

  /**
  * @desc get empty layers message DOM element
  * @returns {DOM Element} div contained message
  */
  createEmptyLayersDOMEl = () => (
    <div className="data-panel-layer-empty">
      <div className="data-item-empty">
        <FontAwesomeIcon icon={faExclamationTriangle} className="error-icon" />
        <p>No visible layers with defined coverage. Add layers or toggle &quot;Include Hidden Layers&quot; if current layers are hidden.</p>
      </div>
    </div>
  )

  render() {
    const {
      activeLayers,
      axisWidth,
      backDate,
      frontDate,
      getMatchingCoverageLineDimensions,
      hoveredLayer,
      timeScale,
      position,
      transformX,
    } = this.props;
    // const { hoveredTooltip } = this.state;
    const emptyLayers = activeLayers.length === 0;
    return (
      <div className="data-panel-layer-list">
        {/* Empty layer data message */
          emptyLayers && this.createEmptyLayersDOMEl()
        }

        {/* Build individual layer data components */
        activeLayers.map((layer, index) => {
          const {
            dateRanges,
            id,
            period,
            startDate,
            visible,
          } = layer;
          if (!dateRanges && !startDate) {
            return null;
          }
          // check for multiple date ranges
          let multipleCoverageRanges = false;
          if (dateRanges && !ignoredLayer[id]) {
            multipleCoverageRanges = dateRanges.length > 1;
          }
          let layerPeriod = this.getFormattedTimePeriod(period);

          // get layer scale number to determine relation to current axis zoom level
          const timeScaleNumber = timeScaleToNumberKey[timeScale];
          const layerScaleNumber = timeScaleToNumberKey[layerPeriod];
          const isLayerGreaterIncrementThanZoom = layerScaleNumber < timeScaleNumber;
          const isLayerEqualIncrementThanZoom = layerScaleNumber === timeScaleNumber;

          // concat (ex: day to days) for moment manipulation below
          layerPeriod += 's';

          // condtional styling for line/background colors
          const {
            layerItemBackground,
            layerItemOutline,
          } = this.getLayerItemStyles(visible, id);

          // get date range
          const dateRange = this.getFormattedDateRange(layer);
          const dateRangeIntervalZeroIndex = dateRanges
            ? Number(dateRanges[0].dateInterval)
            : 1;

          const isValidMultipleRangesLayer = !!(!ignoredLayer[id] && dateRanges);
          const isLayerGreaterZoomWithMultipleCoverage = !!(isLayerGreaterIncrementThanZoom && (multipleCoverageRanges || dateRangeIntervalZeroIndex));
          // const isLayerEqualZoomWithMultipleCoverage = !!(isLayerEqualIncrementThanZoom && dateRangeIntervalZeroIndex && dateRangeIntervalZeroIndex !== 1);
          const isLayerEqualZoomWithMultipleCoverage = !!(isLayerEqualIncrementThanZoom && dateRangeIntervalZeroIndex > 1);
          const key = index;

          return (
            <div
              key={key}
              className={`data-panel-layer-item data-item-${id}`}
              style={{
                background: layerItemBackground,
                outline: layerItemOutline,
              }}
            >
              {/* Layer Header DOM El */
                this.getHeaderDOMEl(layer, visible, dateRange, layerItemBackground)
              }
              <div
                className={`data-panel-layer-coverage-line-container data-line-${id}`}
                style={{
                  maxWidth: `${axisWidth}px`,
                }}
              >
                <DataItemContainer
                  frontDate={frontDate}
                  backDate={backDate}
                  getLayerItemStyles={this.getLayerItemStyles}
                  // getHeaderDOMEl={this.getHeaderDOMEl}
                  getMaxEndDate={this.getMaxEndDate}
                  getDatesInDateRange={this.getDatesInDateRange}
                  axisWidth={axisWidth}
                  position={position}
                  transformX={transformX}
                  // dateRange={dateRange}
                  layer={layer}
                  layerPeriod={layerPeriod}
                  getMatchingCoverageLineDimensions={getMatchingCoverageLineDimensions}
                  getRangeDateEndWithAddedInterval={this.getRangeDateEndWithAddedInterval}
                  // timeScale={timeScale}
                  // hoveredLayer={hoveredLayer}
                  isValidMultipleRangesLayer={isValidMultipleRangesLayer}
                  isLayerGreaterZoomWithMultipleCoverage={isLayerGreaterZoomWithMultipleCoverage}
                  isLayerEqualZoomWithMultipleCoverage={isLayerEqualZoomWithMultipleCoverage}
                  // isLayerGreaterIncrementThanZoom={isLayerGreaterIncrementThanZoom}
                />
              </div>
            </div>
          );
        })
        }
      </div>
    );
  }
}

LayerDataItems.propTypes = {
  activeLayers: PropTypes.array,
  appNow: PropTypes.object,
  axisWidth: PropTypes.number,
  backDate: PropTypes.string,
  frontDate: PropTypes.string,
  getMatchingCoverageLineDimensions: PropTypes.func,
  hoveredLayer: PropTypes.string,
  position: PropTypes.number,
  timeScale: PropTypes.string,
  transformX: PropTypes.number,
};

export default LayerDataItems;
