import React, { Component } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, PanResponder, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient'; // Ensure expo-linear-gradient is installed

export default class ColourWheel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hue: 0, // Hue (0-360 degrees)
      shadePercentage: 50, // Shade percentage (0-100%)
      alpha: 1, // Alpha value (0-1)
      selectedColor: 'rgba(255, 0, 0, 1)', // Initial color with full opacity
      gradientWidth: 0,
      gradientHeight: 0,
      huePosition: new Animated.Value(0), // For line position on hue
      shadePosition: new Animated.Value(0), // For line position on shade
      alphaPosition: new Animated.Value(0), // For line position on alpha
      isCmyMixingEnabled: false,
      gradientPosition: new Animated.Value(0), // For line position on gradient
    };

    // PanResponders for dragging the vertical line
    this.hueResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => this.handleHueSelection(gestureState.moveX),
      onPanResponderRelease: (evt, gestureState) => this.handleHueSelection(gestureState.moveX),
    });

    this.shadeResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => this.handleShadeSelection(gestureState.moveX),
      onPanResponderRelease: (evt, gestureState) => this.handleShadeSelection(gestureState.moveX),
    });

    this.alphaResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => this.handleAlphaSelection(gestureState.moveX),
      onPanResponderRelease: (evt, gestureState) => this.handleAlphaSelection(gestureState.moveX),
    });

    this.gradientResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => this.handleGradientSelection(gestureState.moveX),
      onPanResponderRelease: (evt, gestureState) => this.handleGradientSelection(gestureState.moveX),
    });
  }

  componentDidMount() {
    // Optionally, you can initialize positions here if needed
  }

  toggleCmyMixing = () => {
    this.setState((prevState) => {
      if (prevState.isCmyMixingEnabled) {
        // If CMY mixing is being disabled, recalculate the color without CMY influence
        const [r, g, b] = this.hslToRgb(prevState.hue, 100, prevState.shadePercentage);
        const selectedColor = `rgba(${r}, ${g}, ${b}, ${prevState.alpha})`;
        return {
          isCmyMixingEnabled: false,
          selectedColor, // Reset the selected color without CMY mixing
        };
      }
      return { isCmyMixingEnabled: true };
    }, () => {
      // Optionally, you can recalculate the selectedColor after toggling
      if (this.state.isCmyMixingEnabled) {
        this.handleGradientSelection(this.state.gradientPosition._value);
      }
    });
  };

  // Helper: Convert HSL to RGB
  hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1);
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }

  // Handle selecting a base hue from the hue gradient
  handleHueSelection = (xPosition) => {
    const { gradientWidth, shadePercentage, alpha } = this.state;
    const xPercentage = Math.max(0, Math.min(1, xPosition / gradientWidth));

    // Calculate the new hue (0-360)
    const hue = Math.round(xPercentage * 360);

    // Get new RGB values based on the new hue, current shade, and alpha
    const [r, g, b] = this.hslToRgb(hue, 100, shadePercentage);

    // Update the selected color
    const selectedColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;

    // Update state with new hue and selected color
    this.setState({ hue, selectedColor });

    // Move the hue line to the correct position
    Animated.timing(this.state.huePosition, {
      toValue: xPercentage * gradientWidth, // Ensuring the position is within bounds
      duration: 0,
      useNativeDriver: false,
    }).start();
  };

  // Handle selecting a shade from the shade gradient (lightest to darkest)
  handleShadeSelection = (xPosition) => {
    const { gradientWidth } = this.state;
    const xPercentage = Math.max(0, Math.min(1, xPosition / gradientWidth));

    // Adjust the lightness (shade) of the selected hue
    const lightness = 100 - Math.round(xPercentage * 100); // Brightest on the right, darkest on the left
    const [r, g, b] = this.hslToRgb(this.state.hue, 100, lightness);

    const selectedShade = `rgba(${r}, ${g}, ${b}, ${this.state.alpha})`;

    this.setState({ shadePercentage: lightness, selectedColor: selectedShade });

    // Move the shade line to the correct position
    Animated.timing(this.state.shadePosition, {
      toValue: xPercentage * gradientWidth, // Ensuring the position is within bounds
      duration: 0,
      useNativeDriver: false,
    }).start();
  };

  // Handle selecting alpha (transparency) from the alpha gradient (0-1)
  handleAlphaSelection = (xPosition) => {
    const { gradientWidth } = this.state;
    const xPercentage = Math.max(0, Math.min(1, xPosition / gradientWidth));

    // Calculate alpha (0 to 1)
    const alpha = xPercentage;

    // Update color with new alpha
    const [r, g, b] = this.hslToRgb(this.state.hue, 100, this.state.shadePercentage);
    const newSelectedColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;

    this.setState({ alpha, selectedColor: newSelectedColor });

    // Move the alpha line to the correct position
    Animated.timing(this.state.alphaPosition, {
      toValue: xPercentage * gradientWidth,
      duration: 0,
      useNativeDriver: false,
    }).start();
  };

  // Handle selecting a color from the CMY gradient (Cyan, Magenta, Yellow)
  handleGradientSelection = (xPosition) => {
    const { gradientWidth, selectedColor, alpha, isCmyMixingEnabled } = this.state;
    const xPercentage = Math.max(0, Math.min(1, xPosition / gradientWidth));

    // Convert selected color from HSL to RGB
    const [baseR, baseG, baseB] = this.hslToRgb(this.state.hue, 100, this.state.shadePercentage);

    // Define authentic CMY colors
    const cmyColors = [
      { r: 0, g: 255, b: 255 },   // Cyan
      { r: 255, g: 0, b: 255 },   // Magenta
      { r: 255, g: 255, b: 0 },   // Yellow
    ];

    // Determine which two CMY colors to interpolate between based on xPercentage
    let cmyColor;
    if (xPercentage <= 0.5) {
      // Between Cyan and Magenta
      const interp = xPercentage / 0.5; // 0 to 1
      cmyColor = {
        r: Math.round(cmyColors[0].r + (cmyColors[1].r - cmyColors[0].r) * interp),
        g: Math.round(cmyColors[0].g + (cmyColors[1].g - cmyColors[0].g) * interp),
        b: Math.round(cmyColors[0].b + (cmyColors[1].b - cmyColors[0].b) * interp),
      };
    } else {
      // Between Magenta and Yellow
      const interp = (xPercentage - 0.5) / 0.5; // 0 to 1
      cmyColor = {
        r: Math.round(cmyColors[1].r + (cmyColors[2].r - cmyColors[1].r) * interp),
        g: Math.round(cmyColors[1].g + (cmyColors[2].g - cmyColors[1].g) * interp),
        b: Math.round(cmyColors[1].b + (cmyColors[2].b - cmyColors[1].b) * interp),
      };
    }

    // Calculate the blended color by adding CMY components
    let newRed = baseR;
    let newGreen = baseG;
    let newBlue = baseB;
    let newAlpha = alpha;

    if (isCmyMixingEnabled) {
      // Blend base color with CMY color based on xPercentage
      newRed = Math.min(255, baseR + Math.round(cmyColor.r * xPercentage * 0.2)); // 10% max blend
      newGreen = Math.min(255, baseG + Math.round(cmyColor.g * xPercentage * 0.2));
      newBlue = Math.min(255, baseB + Math.round(cmyColor.b * xPercentage * 0.2));

      // Optionally, adjust alpha slightly
      newAlpha = Math.max(0, Math.min(1, alpha + xPercentage * 0.05)); // Increase alpha by up to 5%
    }

    const newSelectedColor = `rgba(${newRed}, ${newGreen}, ${newBlue}, ${newAlpha})`;

    this.setState({ selectedColor: newSelectedColor });

    // Move the gradient line to the correct position
    Animated.timing(this.state.gradientPosition, {
      toValue: xPercentage * gradientWidth, // Ensuring the position is within bounds
      duration: 0,
      useNativeDriver: false,
    }).start();
  };

  // Adjust the shade gradient based on the hue
  updateShade = (hue) => {
    this.setState({
      shadeGradient: [
        `rgba(${this.state.hue}, 100%, 100%, ${this.state.alpha})`, // White
        `rgba(${this.state.hue}, 100%, 50%, ${this.state.alpha})`,  // Base hue
        `rgba(${this.state.hue}, 100%, 0%, ${this.state.alpha})`,   // Black
      ],
    });
  };

  // Handle the final selection with the select button
  handleSelectColor = () => {
    const { selectedColor } = this.state;
    if (this.props.onColourSelected) {
      this.props.onColourSelected(selectedColor); // Pass the selected color up to App.js
    }
  };

  render() {
    const { hue, selectedColor, shadeGradient, isCmyMixingEnabled } = this.state;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Select a Colour</Text>

        {/* First gradient box: Hue selection */}
        <Text style={styles.label}>Pick a hue:</Text>
        <View 
          style={styles.gradientContainer}
          onLayout={(event) => {
            const { width } = event.nativeEvent.layout;
            this.setState({ gradientWidth: width }, () => {
              // Initialize huePosition based on initial hue
              Animated.timing(this.state.huePosition, {
                toValue: (this.state.hue / 360) * width,
                duration: 0,
                useNativeDriver: false,
              }).start();

              // Initialize shadePosition to the middle
              Animated.timing(this.state.shadePosition, {
                toValue: 0.5 * width, // Middle position
                duration: 0,
                useNativeDriver: false,
              }).start();

              // Initialize alphaPosition based on initial alpha
              Animated.timing(this.state.alphaPosition, {
                toValue: this.state.alpha * width, // Position based on initial alpha
                duration: 0,
                useNativeDriver: false,
              }).start();
            });
          }}
          {...this.hueResponder.panHandlers}
        >
          <LinearGradient
            colors={[
              'rgb(255, 0, 0)', 'rgb(255, 255, 0)', 'rgb(0, 255, 0)', 
              'rgb(0, 255, 255)', 'rgb(0, 0, 255)', 'rgb(255, 0, 255)', 'rgb(255, 0, 0)',
            ]}
            start={[0, 0]} end={[1, 0]}
            style={styles.gradient}
          />
          <Animated.View style={[styles.line, { left: this.state.huePosition }]} />
        </View>

        {/* Second gradient box: Shade selection */}
        <Text style={styles.label}>Pick a shade:</Text>
        <View 
          style={styles.gradientContainer}
          {...this.shadeResponder.panHandlers}
        >
          <LinearGradient
            colors={[
              `hsl(${hue}, 100%, 100%)`, 
              `hsl(${hue}, 100%, 50%)`, 
              `hsl(${hue}, 100%, 0%)`
            ]}
            start={[0, 0]} end={[1, 0]}
            style={styles.gradient}
          />
          <Animated.View style={[styles.line, { left: this.state.shadePosition }]} />
        </View>

        {/* Third gradient box: Alpha selection */}
        <Text style={styles.label}>Pick alpha (transparency):</Text>
        <View 
            style={styles.gradientContainer}
            onLayout={(event) => {
                const { width } = event.nativeEvent.layout;
                this.setState({ 
                    gradientWidth: width,
                }, () => {
                    // Initialize alphaPosition based on initial alpha
                    Animated.timing(this.state.alphaPosition, {
                      toValue: this.state.alpha * width, // Position based on initial alpha
                      duration: 0,
                      useNativeDriver: false,
                    }).start();
                });
            }}
            {...this.alphaResponder.panHandlers}
        >

          <LinearGradient
            colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 1)']} // Alpha gradient from 0 to 1
            start={[0, 0]} end={[1, 0]}
            style={styles.gradient}
          />
          <Animated.View style={[styles.line, { left: this.state.alphaPosition }]} />
        </View>

        {/* Fourth gradient box: CMY color mixing */}
        <Text style={styles.label}>Mix with Cyan, Magenta, Yellow:</Text>
        <TouchableOpacity 
          onPress={this.toggleCmyMixing} 
          style={[
            styles.toggleButton, 
            isCmyMixingEnabled ? styles.buttonDisabled : styles.buttonEnabled
          ]}
        >
          <Text style={styles.toggleButtonText}>
            {isCmyMixingEnabled ? "Disable CMY Mixing" : "Enable CMY Mixing"}
          </Text>
        </TouchableOpacity>
        <View 
          style={styles.gradientContainer}
          {...this.gradientResponder.panHandlers}
        >
          <LinearGradient
            colors={['rgb(0, 255, 255)', 'rgb(255, 0, 255)', 'rgb(255, 255, 0)']} // CMY gradient for subtle mixing
            start={[0, 0]} end={[1, 0]}
            style={styles.gradient}
          />
          <Animated.View style={[styles.line, { left: this.state.gradientPosition }]} />
        </View>

        {/* Display the selected color */}
        <Text style={styles.label}>Selected Color:</Text>
        <View style={[styles.colorPreview, { backgroundColor: selectedColor }]} />

        {/* Select Button */}
        <TouchableOpacity onPress={this.handleSelectColor} style={styles.button}>
          <Text style={styles.buttonText}>Select</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginTop: 10,
  },
  gradientContainer: {
    height: 40,
    marginVertical: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#000',
    position: 'relative',
  },
  gradient: {
    flex: 1,
    borderRadius: 5,
  },
  line: {
    width: 2,
    height: 50,
    backgroundColor: '#000',
    position: 'absolute',
    top: -5,
  },
  colorPreview: {
    height: 100,
    marginVertical: 20,
    borderWidth: 1,
    borderColor: '#000',
  },
  button: {
    backgroundColor: '#1E90FF',
    padding: 10,
    alignItems: 'center',
    marginTop: 20,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
  },
  toggleButton: {
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginVertical: 10,
    borderWidth: 1,
  },
  buttonEnabled: {
    backgroundColor: '#1E90FF', // Blue when enabled (will be shown when disabled)
    borderColor: '#1E90FF',
  },
  buttonDisabled: {
    backgroundColor: '#ddd', // Gray when disabled (will be shown when enabled)
    borderColor: '#ccc',
  },
  toggleButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
