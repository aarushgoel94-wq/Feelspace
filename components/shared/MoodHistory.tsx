import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';
import { getMoodDisplayLabel } from '~app/utils/moodLabels';
import { MoodLevel } from '~app/models/types';

interface MoodDataPoint {
  day: string;
  mood: 'Low' | 'Meh' | 'Okay' | 'Good' | 'Great';
  date: Date;
}

interface MoodHistoryProps {
  moodData?: MoodDataPoint[];
}

// Map moods to numeric values for graphing
const MOOD_VALUES: Record<string, number> = {
  'Low': 1,
  'Meh': 2,
  'Okay': 3,
  'Good': 4,
  'Great': 5,
};

// Map moods to colors
const MOOD_COLORS: Record<string, string> = {
  'Low': '#93C5FD',
  'Meh': '#A5B4FC',
  'Okay': '#818CF8',
  'Good': '#6366F1',
  'Great': '#10B981',
};

const GRAPH_HEIGHT = 180;
const GRAPH_WIDTH = 320;
const PADDING_HORIZONTAL = 40;
const PADDING_VERTICAL = 30;
const POINT_RADIUS = 5;
const CHART_WIDTH = GRAPH_WIDTH - PADDING_HORIZONTAL * 2;
const CHART_HEIGHT = GRAPH_HEIGHT - PADDING_VERTICAL * 2;

export const MoodHistory: React.FC<MoodHistoryProps> = ({
  moodData = [],
}) => {
  // Generate mock data if none provided (for demo)
  // In real app, this would come from storage
  const generateMockData = (): MoodDataPoint[] => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const moods: Array<'Low' | 'Meh' | 'Okay' | 'Good' | 'Great'> = ['Low', 'Meh', 'Okay', 'Good', 'Great'];
    
    // Get last 7 days with realistic mood progression
    const data: MoodDataPoint[] = [];
    const today = new Date();
    
    // Create a more realistic mood progression
    const moodProgression = ['Okay', 'Good', 'Great', 'Good', 'Okay', 'Meh', 'Good'];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
      const dayName = days[dayIndex];
      
      data.push({
        day: dayName,
        mood: moodProgression[6 - i] as 'Low' | 'Meh' | 'Okay' | 'Good' | 'Great',
        date,
      });
    }
    
    return data;
  };

  // Determine what data to display
  const hasData = moodData.length > 0;
  const chartData = hasData ? moodData : [];

  // Calculate positions for each data point
  const getXPosition = (index: number, total: number) => {
    if (total === 1) return PADDING_HORIZONTAL + CHART_WIDTH / 2;
    return PADDING_HORIZONTAL + (CHART_WIDTH / (total - 1)) * index;
  };

  const getYPosition = (mood: string) => {
    const value = MOOD_VALUES[mood] || 3;
    // Invert Y so higher moods are at the top
    const normalizedValue = (value - 1) / 4; // 0 to 1
    return PADDING_VERTICAL + CHART_HEIGHT - (normalizedValue * CHART_HEIGHT);
  };

  // Generate path for smooth line using quadratic bezier curves
  const generatePath = (data: MoodDataPoint[]): string => {
    if (data.length === 0) return '';
    if (data.length === 1) {
      const x = getXPosition(0, 1);
      const y = getYPosition(data[0].mood);
      return `M ${x} ${y}`;
    }

    let path = `M ${getXPosition(0, data.length)} ${getYPosition(data[0].mood)}`;
    
    for (let i = 1; i < data.length; i++) {
      const x0 = getXPosition(i - 1, data.length);
      const y0 = getYPosition(data[i - 1].mood);
      const x1 = getXPosition(i, data.length);
      const y1 = getYPosition(data[i].mood);
      
      // Create smooth curve using control point at midpoint
      const cx = (x0 + x1) / 2;
      
      if (i === 1) {
        // First curve
        path += ` Q ${cx} ${y0} ${x1} ${y1}`;
      } else {
        // Subsequent curves - use smooth curves
        path += ` T ${x1} ${y1}`;
      }
    }
    
    return path;
  };

  // Get mood bands for Y-axis (abstract labels)
  const getMoodBands = () => {
    return [
      { label: getMoodDisplayLabel('Low'), y: PADDING_VERTICAL + CHART_HEIGHT - (0 * CHART_HEIGHT / 4) },
      { label: getMoodDisplayLabel('Okay'), y: PADDING_VERTICAL + CHART_HEIGHT - (2 * CHART_HEIGHT / 4) },
      { label: getMoodDisplayLabel('Great'), y: PADDING_VERTICAL + CHART_HEIGHT - (4 * CHART_HEIGHT / 4) },
    ];
  };

  const pathData = generatePath(chartData);
  const moodBands = getMoodBands();

  // Empty state - show when no data provided
  if (!hasData) {
    return (
      <Animated.View entering={FadeInDown.delay(250).duration(400)}>
        <Card variant="elevated" style={styles.card}>
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIllustration}>
              <Svg width="120" height="100" viewBox="0 0 120 100">
                {/* Simple, friendly wave illustration */}
                <Path
                  d="M 0 50 Q 20 40 40 50 T 80 50 T 120 50"
                  stroke={theme.colors.primary.light}
                  strokeWidth="2"
                  fill="none"
                  opacity={0.4}
                />
                <Path
                  d="M 0 60 Q 20 50 40 60 T 80 60 T 120 60"
                  stroke={theme.colors.primary.main}
                  strokeWidth="2"
                  fill="none"
                  opacity={0.3}
                />
                {/* Floating dots */}
                <Circle cx="20" cy="45" r="3" fill={theme.colors.primary.light} opacity={0.5} />
                <Circle cx="60" cy="55" r="3" fill={theme.colors.primary.main} opacity={0.4} />
                <Circle cx="100" cy="48" r="3" fill={theme.colors.accent.lavender} opacity={0.5} />
              </Svg>
            </View>
            <Text 
              style={styles.emptyTitle}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
            >
              Your mood journey will show up here
            </Text>
            <Text 
              style={styles.emptySubtext}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
            >
              Start logging your mood to see patterns over time
            </Text>
          </View>
        </Card>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.delay(250).duration(400)}>
      <Card variant="elevated" style={styles.card}>
        <View style={styles.container}>
            <Text 
              style={styles.title}
              allowFontScaling
              maxFontSizeMultiplier={1.3}
            >
              Mood History
            </Text>
          
          <View style={styles.graphContainer}>
            <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT} viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}>
              <Defs>
                <LinearGradient id="moodGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0%" stopColor={theme.colors.accent.sage} stopOpacity="0.3" />
                  <Stop offset="100%" stopColor={theme.colors.primary.main} stopOpacity="0.1" />
                </LinearGradient>
              </Defs>

              {/* Y-axis mood bands (subtle guides, not harsh grid) */}
              {moodBands.map((band) => (
                <Line
                  key={band.label}
                  x1={PADDING_HORIZONTAL}
                  y1={band.y}
                  x2={PADDING_HORIZONTAL + CHART_WIDTH}
                  y2={band.y}
                  stroke={theme.colors.border.light}
                  strokeWidth="1"
                  strokeDasharray="3 4"
                  opacity={0.2}
                />
              ))}

              {/* Gradient area under the line */}
              {chartData.length > 0 && (
                <Path
                  d={`${pathData} L ${getXPosition(chartData.length - 1, chartData.length)} ${PADDING_VERTICAL + CHART_HEIGHT} L ${getXPosition(0, chartData.length)} ${PADDING_VERTICAL + CHART_HEIGHT} Z`}
                  fill="url(#moodGradient)"
                />
              )}

              {/* Main line */}
              {chartData.length > 0 && (
                <Path
                  d={pathData}
                  stroke={theme.colors.primary.main}
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {chartData.map((point, index) => {
                const x = getXPosition(index, chartData.length);
                const y = getYPosition(point.mood);
                const color = MOOD_COLORS[point.mood] || theme.colors.primary.main;

                return (
                  <Circle
                    key={index}
                    cx={x}
                    cy={y}
                    r={POINT_RADIUS}
                    fill={color}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                );
              })}
            </Svg>

            {/* X-axis labels (days) */}
            <View style={styles.xAxis}>
              {chartData.map((point, index) => (
                <Text 
                  key={index} 
                  style={styles.xAxisLabel}
                  allowFontScaling
                  maxFontSizeMultiplier={1.3}
                >
                  {point.day}
                </Text>
              ))}
            </View>

            {/* Y-axis labels (mood bands) - positioned absolutely */}
            <View style={styles.yAxis}>
              {moodBands.map((band) => (
                <Text 
                  key={band.label} 
                  style={[styles.yAxisLabel, { top: band.y - 8 }]}
                  allowFontScaling
                  maxFontSizeMultiplier={1.3}
                >
                  {band.label}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: theme.spacing.lg,
  },
  container: {
    padding: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
    marginBottom: theme.spacing.lg,
  },
  graphContainer: {
    alignItems: 'center',
    position: 'relative',
    marginBottom: theme.spacing.sm,
  },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: GRAPH_WIDTH - PADDING_HORIZONTAL * 2,
    marginLeft: PADDING_HORIZONTAL,
    marginTop: theme.spacing.sm,
  },
  xAxisLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
    flex: 1,
  },
  yAxis: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: GRAPH_HEIGHT,
    width: PADDING_HORIZONTAL - theme.spacing.sm,
    justifyContent: 'flex-start',
  },
  yAxisLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.text.tertiary,
    fontFamily: theme.typography.fontFamily.regular,
    position: 'absolute',
    right: theme.spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['2xl'],
    paddingHorizontal: theme.spacing.lg,
  },
  emptyIllustration: {
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.semibold,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
    lineHeight: theme.typography.fontSize.sm * theme.typography.lineHeight.relaxed,
  },
});

