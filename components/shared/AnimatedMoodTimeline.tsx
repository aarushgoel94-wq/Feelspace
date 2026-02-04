import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View, useColorScheme, ScrollView } from 'react-native';
import { MoodLog } from '~app/models/types';
import { theme } from '~app/theme';
import { getMoodDisplayLabel } from '~app/utils/moodLabels';
import { triggerHapticImpact } from '~app/utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Constants - larger and more readable
const CHART_HEIGHT = 280;
const CHART_PADDING_TOP = 20;
const CHART_PADDING_BOTTOM = 20;
const CHART_PADDING_LEFT = 20;
const Y_AXIS_WIDTH = 55;
const POINT_SIZE = 28;
const POINT_SPACING = 55;
const MIN_TOUCH = 44;
const X_AXIS_HEIGHT = 45;
const POINTS_PER_PAGE = 30; // Show 30 points per page
const DAYS_PER_PAGE = 30; // Alternative: show 30 days per page

// Mood mapping
const MOOD_VALUES: Record<string, number> = {
  'Low': 1,
  'Meh': 2,
  'Okay': 3,
  'Good': 4,
  'Great': 5,
};

const MOOD_EMOJIS: Record<string, string> = {
  'Low': '😔',
  'Meh': '😐',
  'Okay': '😊',
  'Good': '😄',
  'Great': '😁',
};

const MOOD_COLORS: Record<string, { light: string; dark: string }> = {
  'Low': { light: '#B8C5E8', dark: '#A5B4D6' },
  'Meh': { light: '#D4C5FF', dark: '#C4B5FD' },
  'Okay': { light: '#B5C4FC', dark: '#A5B4FC' },
  'Good': { light: '#A5D4C5', dark: '#95C4B5' },
  'Great': { light: '#95D4A5', dark: '#85C495' },
};

interface Point {
  id: string;
  x: number;
  y: number;
  mood: string;
  moodValue: number;
  date: string;
  log: MoodLog;
  shortDate: string;
  fullDate: string;
  label: string;
}

interface Props {
  moodLogs: MoodLog[];
  onPointPress?: (log: MoodLog) => void;
  selectedDate?: string;
}

export const AnimatedMoodTimeline: React.FC<Props> = ({ moodLogs, onPointPress, selectedDate }) => {
  const isDark = useColorScheme() === 'dark';
  const [selected, setSelected] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Calculate chart area - FIXED: Use consistent calculations
  const CHART_AREA_HEIGHT = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;
  const CHART_AREA_TOP = CHART_PADDING_TOP;
  const MOOD_LEVELS = 5;
  // Calculate tick spacing: divide available height by number of intervals (4 intervals for 5 levels)
  const TICK_SPACING = CHART_AREA_HEIGHT / 4;

  // Helper function to calculate Y position - SINGLE SOURCE OF TRUTH
  const calculateYPosition = useCallback((moodValue: number): number => {
    // Formula: y = CHART_AREA_TOP + (MOOD_LEVELS - moodValue) * TICK_SPACING
    // This ensures:
    // - Great (5) is at the top: TOP + (5-5)*SPACING = TOP
    // - Low (1) is at the bottom: TOP + (5-1)*SPACING = TOP + 4*SPACING = TOP + HEIGHT
    const gridPosition = MOOD_LEVELS - moodValue;
    const y = CHART_AREA_TOP + gridPosition * TICK_SPACING;
    return Math.round(y);
  }, [CHART_AREA_TOP, TICK_SPACING]);

  // Y-axis labels - Use the helper function
  const yLabels = useMemo(() => {
    const labels = [
      { label: 'Great', value: 5 },
      { label: 'Good', value: 4 },
      { label: 'Okay', value: 3 },
      { label: 'Meh', value: 2 },
      { label: 'Low', value: 1 },
    ];
    return labels.map(item => ({
      label: item.label,
      value: item.value,
      y: calculateYPosition(item.value),
    }));
  }, [calculateYPosition]);

  // Process and paginate points
  const { allPoints, totalPages, currentPagePoints } = useMemo(() => {
    const result: Point[] = [];
    
    if (!Array.isArray(moodLogs)) {
      return { allPoints: [], totalPages: 1, currentPagePoints: [] };
    }

    // Filter valid logs
    const validLogs: MoodLog[] = [];
    for (let i = 0; i < moodLogs.length; i++) {
      const log = moodLogs[i];
      if (!log) continue;
      if (typeof log !== 'object') continue;
      if (!log.id || typeof log.id !== 'string') continue;
      if (!log.date || typeof log.date !== 'string') continue;
      if (!log.moodLevel || typeof log.moodLevel !== 'string') continue;
      validLogs.push(log);
    }

    // Sort by date
    validLogs.sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return a.date.localeCompare(b.date);
    });

    // Process each log
    for (let i = 0; i < validLogs.length; i++) {
      const log = validLogs[i];
      try {
        // Validate mood - normalize
        const moodLevel = String(log.moodLevel).trim();
        let moodValue = MOOD_VALUES[moodLevel];
        
        // Case-insensitive fallback
        if (!moodValue) {
          const normalized = Object.keys(MOOD_VALUES).find(
            key => key.toLowerCase() === moodLevel.toLowerCase()
          );
          if (normalized) {
            moodValue = MOOD_VALUES[normalized];
          } else {
            continue;
          }
        }

        if (!moodValue || moodValue < 1 || moodValue > 5) {
          continue;
        }

        // Validate date
        const dateStr = String(log.date).trim();
        if (!dateStr) {
          continue;
        }
        const date = new Date(dateStr + 'T00:00:00');
        if (isNaN(date.getTime())) {
          continue;
        }

        // Calculate Y position using the helper function
        const y = calculateYPosition(moodValue);

        // Calculate X position - relative to page start
        const x = CHART_PADDING_LEFT + (i % POINTS_PER_PAGE) * POINT_SPACING;

        // Validate coordinates
        if (!isFinite(x) || !isFinite(y)) {
          continue;
        }

        // Format dates
        const shortDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const fullDate = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        });

        result.push({
          id: String(log.id),
          x: Math.round(x),
          y: y, // Use exact Y from helper function
          mood: moodLevel,
          moodValue: moodValue,
          date: dateStr,
          log: log,
          shortDate: shortDate,
          fullDate: fullDate,
          label: getMoodDisplayLabel(moodLevel),
        });
      } catch (error) {
        continue;
      }
    }

    // Calculate pagination
    const totalPages = Math.max(1, Math.ceil(result.length / POINTS_PER_PAGE));
    const startIndex = currentPage * POINTS_PER_PAGE;
    const endIndex = Math.min(startIndex + POINTS_PER_PAGE, result.length);
    const currentPagePoints = result.slice(startIndex, endIndex);

    return { allPoints: result, totalPages, currentPagePoints };
  }, [moodLogs, calculateYPosition, currentPage]);

  // Chart width
  const chartWidth = useMemo(() => {
    if (currentPagePoints.length === 0) {
      return SCREEN_WIDTH - Y_AXIS_WIDTH;
    }
    const lastX = currentPagePoints[currentPagePoints.length - 1]?.x || CHART_PADDING_LEFT;
    const minWidth = SCREEN_WIDTH - Y_AXIS_WIDTH;
    const calculatedWidth = lastX + CHART_PADDING_LEFT + POINT_SPACING;
    return Math.max(minWidth, calculatedWidth);
  }, [currentPagePoints]);

  // Handle press
  const handlePress = useCallback((point: Point) => {
    try {
      triggerHapticImpact().catch(() => {});
      setSelected(point.date);
      if (onPointPress) {
        onPointPress(point.log);
      }
    } catch (error) {
      // Ignore errors
    }
  }, [onPointPress]);

  // Sync selected
  useEffect(() => {
    if (selectedDate !== undefined) {
      setSelected(selectedDate);
    }
  }, [selectedDate]);

  // Reset to first page when moodLogs change
  useEffect(() => {
    setCurrentPage(0);
  }, [moodLogs.length]);

  // Build valid points array
  const validPoints: Point[] = [];
  for (const point of currentPagePoints) {
    if (isFinite(point.x) && isFinite(point.y) && !isNaN(point.x) && !isNaN(point.y)) {
      validPoints.push(point);
    }
  }

  // Build date labels
  const dateLabels: Point[] = [];
  const numLabels = 6;
  const step = Math.max(1, Math.floor(validPoints.length / numLabels));
  for (let i = 0; i < validPoints.length; i++) {
    if (i % step === 0 || i === validPoints.length - 1) {
      if (isFinite(validPoints[i].x)) {
        dateLabels.push(validPoints[i]);
      }
    }
  }

  const selectedPoint = allPoints.find(p => p.date === selected);

  // Empty state
  if (allPoints.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🌱</Text>
        <Text style={styles.emptyTitle}>Your journey starts here</Text>
        <Text style={styles.emptyText}>Start logging your mood to see your timeline</Text>
      </View>
    );
  }

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      scrollViewRef.current?.scrollTo({ x: 0, animated: false });
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
      scrollViewRef.current?.scrollTo({ x: 0, animated: false });
    }
  };

  // Calculate date range for current page
  const pageStartDate = currentPagePoints[0]?.date;
  const pageEndDate = currentPagePoints[currentPagePoints.length - 1]?.date;
  const pageDateRange = pageStartDate && pageEndDate
    ? `${new Date(pageStartDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(pageEndDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : '';

  return (
    <View style={styles.container}>
      {/* Pagination header */}
      {totalPages > 1 && (
        <View style={styles.paginationHeader}>
          <TouchableOpacity
            onPress={handlePreviousPage}
            disabled={currentPage === 0}
            style={[styles.pageButton, currentPage === 0 && styles.pageButtonDisabled]}
          >
            <Text style={[styles.pageButtonText, currentPage === 0 && styles.pageButtonTextDisabled]}>
              ← Previous
            </Text>
          </TouchableOpacity>
          <View style={styles.pageInfo}>
            <Text style={styles.pageInfoText}>
              Page {currentPage + 1} of {totalPages}
            </Text>
            {pageDateRange && (
              <Text style={styles.pageDateText}>{pageDateRange}</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={handleNextPage}
            disabled={currentPage === totalPages - 1}
            style={[styles.pageButton, currentPage === totalPages - 1 && styles.pageButtonDisabled]}
          >
            <Text style={[styles.pageButtonText, currentPage === totalPages - 1 && styles.pageButtonTextDisabled]}>
              Next →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Y-axis labels - aligned with grid lines */}
      <View style={styles.yAxis}>
        {yLabels.map((item, idx) => (
          <Text 
            key={`y-${idx}`} 
            style={[
              styles.yLabel, 
              { 
                top: item.y - 10, // Center the text on the grid line (text is ~20px tall)
              }
            ]}
          >
            {item.label}
          </Text>
        ))}
      </View>

      {/* Scrollable chart */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={[styles.scroll, { width: chartWidth }]}
        bounces={false}
        scrollEventThrottle={16}
      >
        <View style={[styles.chart, { width: chartWidth }]}>
          {/* Background grid - aligned with Y-axis labels */}
          <View style={styles.chartBg}>
            {yLabels.map((item, idx) => (
              <View
                key={`grid-${idx}`}
                style={[
                  styles.gridLine,
                  { 
                    top: item.y, // Exact same Y position as labels
                    width: chartWidth - CHART_PADDING_LEFT * 2,
                    left: CHART_PADDING_LEFT,
                  },
                ]}
              />
            ))}
          </View>

          {/* Line segments */}
          <View style={styles.lineContainer}>
            {validPoints.length > 1 && (() => {
              const segments: JSX.Element[] = [];
              for (let i = 1; i < validPoints.length; i++) {
                const prev = validPoints[i - 1];
                const curr = validPoints[i];
                if (!prev || !curr) continue;
                if (!isFinite(prev.x) || !isFinite(prev.y) || !isFinite(curr.x) || !isFinite(curr.y)) {
                  continue;
                }
                
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                
                segments.push(
                  <View
                    key={`line-${i}`}
                    style={[
                      styles.lineSegment,
                      {
                        left: prev.x,
                        top: prev.y,
                        width: length,
                        transform: [{ rotate: `${angle}deg` }],
                      },
                    ]}
                  />
                );
              }
              return segments;
            })()}
          </View>

          {/* Points - aligned with grid lines */}
          <View style={styles.pointsContainer}>
            {validPoints.map((point) => {
              const isSelected = point.date === selected;
              const color = MOOD_COLORS[point.mood]?.[isDark ? 'dark' : 'light'] || MOOD_COLORS['Okay'][isDark ? 'dark' : 'light'];
              const emoji = MOOD_EMOJIS[point.mood] || '😊';
              
              return (
                <View key={`point-wrapper-${point.id}`} style={styles.pointWrapper}>
                  {/* Selected glow */}
                  {isSelected && (
                    <View
                      style={[
                        styles.pointGlow,
                        {
                          left: point.x - POINT_SIZE / 2 - 8,
                          top: point.y - POINT_SIZE / 2 - 8,
                          width: POINT_SIZE + 16,
                          height: POINT_SIZE + 16,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  )}
                  {/* Point circle - center on calculated Y */}
                  <View
                    style={[
                      styles.pointCircle,
                      {
                        left: point.x - POINT_SIZE / 2,
                        top: point.y - POINT_SIZE / 2, // Center point on grid line
                        width: POINT_SIZE,
                        height: POINT_SIZE,
                        backgroundColor: color,
                        borderWidth: isSelected ? 3 : 2,
                      },
                    ]}
                  >
                    <Text style={styles.pointEmoji}>{emoji}</Text>
                  </View>
                  {/* Touch target */}
                  <TouchableOpacity
                    style={[
                      styles.pointTouch,
                      {
                        left: point.x - MIN_TOUCH / 2,
                        top: point.y - MIN_TOUCH / 2,
                      },
                    ]}
                    onPress={() => handlePress(point)}
                    activeOpacity={0.7}
                  />
                </View>
              );
            })}
          </View>

          {/* Date labels */}
          <View style={styles.dates}>
            {dateLabels.map((point) => {
              const isSelected = point.date === selected;
              return (
                <TouchableOpacity
                  key={`date-${point.id}`}
                  style={[styles.date, { left: point.x - 30 }]}
                  onPress={() => handlePress(point)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dateText, isSelected && styles.dateSelected]}>
                    {point.shortDate}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Selected info */}
      {selectedPoint && (
        <View style={styles.info}>
          <Text style={styles.infoEmoji}>{MOOD_EMOJIS[selectedPoint.mood] || '😊'}</Text>
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>{selectedPoint.label}</Text>
            <Text style={styles.infoDate}>{selectedPoint.fullDate}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius['2xl'],
    padding: theme.spacing.lg,
    ...theme.shadows.small,
    minHeight: CHART_HEIGHT + X_AXIS_HEIGHT + 80,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['4xl'],
    minHeight: 300,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  paginationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  pageButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary.subtle,
    minWidth: 80,
    alignItems: 'center',
  },
  pageButtonDisabled: {
    backgroundColor: theme.colors.background.secondary,
    opacity: 0.5,
  },
  pageButtonText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary.main,
    fontFamily: theme.typography.fontFamily.medium,
  },
  pageButtonTextDisabled: {
    color: theme.colors.text.tertiary,
  },
  pageInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  pageInfoText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  pageDateText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    marginTop: theme.spacing.xs / 2,
  },
  yAxis: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: Y_AXIS_WIDTH,
    height: CHART_HEIGHT,
    zIndex: 1,
  },
  yLabel: {
    position: 'absolute',
    fontSize: 14,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    right: theme.spacing.xs,
    fontWeight: theme.typography.fontWeight.medium,
    textAlign: 'right',
  },
  scroll: {
    paddingLeft: Y_AXIS_WIDTH,
  },
  chart: {
    position: 'relative',
    height: CHART_HEIGHT + X_AXIS_HEIGHT,
  },
  chartBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: CHART_HEIGHT,
  },
  gridLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: theme.colors.border.light,
    opacity: 0.08,
  },
  lineContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: CHART_HEIGHT,
    zIndex: 1,
  },
  lineSegment: {
    position: 'absolute',
    height: 3,
    backgroundColor: theme.colors.primary.main,
    transformOrigin: 'left center',
  },
  pointsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: CHART_HEIGHT,
    zIndex: 2,
  },
  pointWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: CHART_HEIGHT,
  },
  pointGlow: {
    position: 'absolute',
    borderRadius: (POINT_SIZE + 16) / 2,
    opacity: 0.25,
  },
  pointCircle: {
    position: 'absolute',
    borderRadius: POINT_SIZE / 2,
    borderColor: theme.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  pointEmoji: {
    fontSize: 20,
    textAlign: 'center',
    lineHeight: POINT_SIZE,
    width: POINT_SIZE,
    height: POINT_SIZE,
  },
  pointTouch: {
    position: 'absolute',
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
  },
  dates: {
    position: 'absolute',
    top: CHART_HEIGHT + 8,
    left: 0,
    height: X_AXIS_HEIGHT,
  },
  date: {
    position: 'absolute',
    width: 60,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
  },
  dateSelected: {
    color: theme.colors.primary.main,
    fontWeight: theme.typography.fontWeight.semibold,
    fontSize: 13,
  },
  info: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoEmoji: {
    fontSize: 28,
    marginRight: theme.spacing.md,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: theme.spacing.xs / 2,
  },
  infoDate: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
});
