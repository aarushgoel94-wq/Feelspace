import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { Card } from '~app/components/shared/Card';
import { theme } from '~app/theme';
import { getMoodDisplayLabel } from '~app/utils/moodLabels';

interface MoodDataPoint {
  day: string;
  mood: 'Low' | 'Meh' | 'Okay' | 'Good' | 'Great';
  date: Date;
}

interface MoodHistorySnapshotProps {
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

const GRAPH_HEIGHT = 160; // Taller for better visibility
const GRAPH_WIDTH = 320; // Wider for cleaner look
const PADDING_HORIZONTAL = 40;
const PADDING_VERTICAL = 30;
const POINT_RADIUS = 5; // Larger points
const CHART_WIDTH = GRAPH_WIDTH - PADDING_HORIZONTAL * 2;
const CHART_HEIGHT = GRAPH_HEIGHT - PADDING_VERTICAL * 2;

/**
 * Mini mood history graph - compact snapshot version
 */
export const MoodHistorySnapshot: React.FC<MoodHistorySnapshotProps> = ({
  moodData = [],
}) => {
  const router = useRouter();
  
  // Generate mock data if none provided
  const generateMockData = (): MoodDataPoint[] => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    
    const moodProgression = ['Okay', 'Good', 'Great', 'Good', 'Okay', 'Meh', 'Good'];
    
    const data: MoodDataPoint[] = [];
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

  const chartData = moodData.length > 0 ? moodData : generateMockData();
  const hasData = chartData.length > 0;

  // Calculate positions for each data point
  const getXPosition = (index: number, total: number) => {
    if (total === 1) return PADDING_HORIZONTAL + CHART_WIDTH / 2;
    return PADDING_HORIZONTAL + (CHART_WIDTH / (total - 1)) * index;
  };

  const getYPosition = (mood: string) => {
    const value = MOOD_VALUES[mood] || 3;
    const normalizedValue = (value - 1) / 4; // 0 to 1
    return PADDING_VERTICAL + CHART_HEIGHT - (normalizedValue * CHART_HEIGHT);
  };

  // Generate smooth path for the line
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
      
      const cx = (x0 + x1) / 2;
      
      if (i === 1) {
        path += ` Q ${cx} ${y0} ${x1} ${y1}`;
      } else {
        path += ` T ${x1} ${y1}`;
      }
    }
    
    return path;
  };

  const pathData = generatePath(chartData);

  const handlePress = () => {
    router.push('/mood-history');
  };

  return (
    <Animated.View entering={FadeInDown.delay(400).duration(400)}>
      <TouchableOpacity activeOpacity={0.7} onPress={handlePress}>
        <Card variant="elevated" style={styles.card}>
        <View style={styles.container}>
          <Text style={styles.title} allowFontScaling maxFontSizeMultiplier={1.3}>
            Mood History
          </Text>
          <Text style={styles.subtitle} allowFontScaling maxFontSizeMultiplier={1.3}>
            Last 7 days
          </Text>
          
          {hasData && (
            <View style={styles.graphContainer}>
              <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT} viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}>
                <Defs>
                  <LinearGradient id="miniMoodGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor={theme.colors.primary.main} stopOpacity="0.15" />
                    <Stop offset="100%" stopColor={theme.colors.primary.main} stopOpacity="0.03" />
                  </LinearGradient>
                </Defs>

                {/* Minimal grid lines - very subtle */}
                {[1, 2, 3, 4, 5].map((value) => {
                  const y = PADDING_VERTICAL + CHART_HEIGHT - ((value - 1) / 4) * CHART_HEIGHT;
                  return (
                    <Line
                      key={value}
                      x1={PADDING_HORIZONTAL}
                      y1={y}
                      x2={PADDING_HORIZONTAL + CHART_WIDTH}
                      y2={y}
                      stroke={theme.colors.border.light}
                      strokeWidth="0.5"
                      strokeDasharray="2 4"
                      opacity={0.15} // Very minimal grid lines
                    />
                  );
                })}

                {/* Gradient area under the line */}
                {chartData.length > 0 && (
                  <Path
                    d={`${pathData} L ${getXPosition(chartData.length - 1, chartData.length)} ${PADDING_VERTICAL + CHART_HEIGHT} L ${getXPosition(0, chartData.length)} ${PADDING_VERTICAL + CHART_HEIGHT} Z`}
                    fill="url(#miniMoodGradient)"
                  />
                )}

                {/* Main line - soft colors */}
                {chartData.length > 0 && (
                  <Path
                    d={pathData}
                    stroke={theme.colors.primary.main}
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.8} // Softer appearance
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
                      stroke={theme.colors.background.primary}
                      strokeWidth="2"
                      opacity={0.9} // Softer appearance
                    />
                  );
                })}
              </Svg>

              {/* X-axis labels (days) */}
              <View style={styles.xAxis}>
                {chartData.map((point, index) => (
                  <Text key={index} style={styles.xAxisLabel} allowFontScaling maxFontSizeMultiplier={1.3}>
                    {point.day}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {!hasData && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText} allowFontScaling maxFontSizeMultiplier={1.3}>
                Start logging your mood to see your history
              </Text>
            </View>
          )}
        </View>
        </Card>
      </TouchableOpacity>
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
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.xs / 2,
    numberOfLines: 1,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.regular,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    marginBottom: theme.spacing.md,
    numberOfLines: 1,
  },
  graphContainer: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
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
  emptyContainer: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
  },
});

