import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import { theme } from '~app/theme';

interface IllustrationProps {
  type: 'waves' | 'shield' | 'rooms';
}

export const Illustration: React.FC<IllustrationProps> = ({ type }) => {
  if (type === 'waves') {
    return (
      <View style={styles.container}>
        <Svg width={240} height={180} viewBox="0 0 200 150" preserveAspectRatio="xMidYMid meet">
          <Path
            d="M0,75 Q50,50 100,75 T200,75 L200,150 L0,150 Z"
            fill={theme.colors.primary.light}
            opacity={0.3}
          />
          <Path
            d="M0,90 Q50,65 100,90 T200,90 L200,150 L0,150 Z"
            fill={theme.colors.primary.main}
            opacity={0.4}
          />
          <Path
            d="M0,105 Q50,80 100,105 T200,105 L200,150 L0,150 Z"
            fill={theme.colors.accent.lavender}
            opacity={0.3}
          />
        </Svg>
      </View>
    );
  }

  if (type === 'shield') {
    return (
      <View style={styles.container}>
        <Svg width={200} height={200} viewBox="0 0 180 180" preserveAspectRatio="xMidYMid meet">
          <Path
            d="M90,20 L150,45 L150,90 Q150,130 120,150 Q90,170 60,150 Q30,130 30,90 L30,45 Z"
            fill={theme.colors.primary.subtle}
            stroke={theme.colors.primary.main}
            strokeWidth={3}
          />
          <Circle cx={90} cy={90} r={25} fill={theme.colors.primary.main} opacity={0.2} />
          <Circle cx={90} cy={90} r={15} fill={theme.colors.primary.main} />
        </Svg>
      </View>
    );
  }

  if (type === 'rooms') {
    return (
      <View style={styles.container}>
        <Svg width={200} height={150} viewBox="0 0 200 150">
          <Ellipse cx={50} cy={50} rx={30} ry={30} fill={theme.colors.primary.light} opacity={0.4} />
          <Ellipse cx={100} cy={50} rx={30} ry={30} fill={theme.colors.accent.lavender} opacity={0.4} />
          <Ellipse cx={150} cy={50} rx={30} ry={30} fill={theme.colors.accent.sage} opacity={0.4} />
          <Ellipse cx={75} cy={100} rx={30} ry={30} fill={theme.colors.primary.main} opacity={0.3} />
          <Ellipse cx={125} cy={100} rx={30} ry={30} fill={theme.colors.primary.light} opacity={0.3} />
        </Svg>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 280,
    alignSelf: 'center',
  },
});

