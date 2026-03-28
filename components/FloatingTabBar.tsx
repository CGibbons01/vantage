import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
  Pressable,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

const ACTIVE_COLOR = '#9D6FFF';
const INACTIVE_COLOR = '#6B5F8A';
const TAB_BG = '#161230';
const BORDER_COLOR = 'rgba(124, 58, 237, 0.3)';
const INDICATOR_BG = 'rgba(124, 58, 237, 0.18)';

export interface TabBarItem {
  name: string;
  route: Href;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}

interface FloatingTabBarProps {
  tabs: TabBarItem[];
  containerWidth?: number;
  borderRadius?: number;
  bottomMargin?: number;
}

export default function FloatingTabBar({
  tabs,
  containerWidth = screenWidth / 2.5,
  borderRadius = 35,
  bottomMargin,
}: FloatingTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const animatedValue = useSharedValue(0);

  const activeTabIndex = React.useMemo(() => {
    let bestMatch = -1;
    let bestMatchScore = 0;

    tabs.forEach((tab, index) => {
      let score = 0;
      if (pathname === tab.route) {
        score = 100;
      } else if (pathname.startsWith(tab.route as string)) {
        score = 80;
      } else if (pathname.includes(tab.name)) {
        score = 60;
      } else if (tab.route.includes('/(tabs)/') && pathname.includes((tab.route as string).split('/(tabs)/')[1])) {
        score = 40;
      }
      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatch = index;
      }
    });

    return bestMatch >= 0 ? bestMatch : 0;
  }, [pathname, tabs]);

  React.useEffect(() => {
    if (activeTabIndex >= 0) {
      animatedValue.value = withSpring(activeTabIndex, {
        damping: 20,
        stiffness: 120,
        mass: 1,
      });
    }
  }, [activeTabIndex, animatedValue]);

  const handleTabPress = (route: Href, label: string) => {
    console.log('[TabBar] Tab pressed:', label);
    router.push(route);
  };

  const tabWidthPercent = ((100 / tabs.length) - 1).toFixed(2);

  const indicatorStyle = useAnimatedStyle(() => {
    const tabWidth = (containerWidth - 8) / tabs.length;
    return {
      transform: [
        {
          translateX: interpolate(
            animatedValue.value,
            [0, tabs.length - 1],
            [0, tabWidth * (tabs.length - 1)]
          ),
        },
      ],
    };
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View
        style={[
          styles.container,
          { width: containerWidth, marginBottom: bottomMargin ?? 20 },
        ]}
      >
        {/* Purple top border glow */}
        <View style={[styles.topBorderGlow, { borderRadius }]} />

        <View
          style={[
            styles.tabBarInner,
            { borderRadius },
          ]}
        >
          {/* Sliding active indicator */}
          <Animated.View
            style={[
              styles.indicator,
              { width: `${tabWidthPercent}%` as `${number}%` },
              indicatorStyle,
            ]}
          />

          <View style={styles.tabsContainer}>
            {tabs.map((tab, index) => {
              const isActive = activeTabIndex === index;
              const iconColor = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
              const labelColor = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;

              return (
                <Pressable
                  key={tab.name}
                  style={styles.tab}
                  onPress={() => handleTabPress(tab.route, tab.label)}
                  accessibilityRole="button"
                  accessibilityLabel={tab.label}
                >
                  <View style={styles.tabContent}>
                    <IconSymbol
                      android_material_icon_name={tab.icon}
                      ios_icon_name={tab.icon}
                      size={22}
                      color={iconColor}
                    />
                    <Text
                      style={[
                        styles.tabLabel,
                        { color: labelColor },
                        isActive && styles.tabLabelActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  container: {
    marginHorizontal: 20,
    alignSelf: 'center',
  },
  topBorderGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: BORDER_COLOR,
    zIndex: 1,
  },
  tabBarInner: {
    backgroundColor: TAB_BG,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: 2,
    bottom: 4,
    borderRadius: 27,
    backgroundColor: INDICATOR_BG,
  },
  tabsContainer: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minHeight: 44,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
});
