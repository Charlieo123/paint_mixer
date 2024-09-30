import React, { Component } from 'react';
import { View, Text, Button, StyleSheet, TouchableOpacity } from 'react-native';
import PropTypes from 'prop-types';

export default class ColourDisplay extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedMix: null, // State to track which mix is selected
    };
  }

  handleMixSelection = (mix) => {
    console.log('Selected Mix:', mix);
    this.setState({ selectedMix: mix });
  };

  render() {
    const { colour, lighterMix, actualMix, darkerMix } = this.props;
    console.log("Lighter Mix:", lighterMix);
    console.log("Actual Mix:", actualMix);
    console.log("Darker Mix:", darkerMix);
    const { selectedMix } = this.state;

    // Display selected mix or a default message
    const mixDisplay = selectedMix ? (
      <View style={styles.mixContainer}>
        <Text style={styles.header}>Mix Ratios:</Text>
        {Object.keys(selectedMix.ratios).map((color) => (
          <Text key={color} style={styles.mixText}>
            {color}: {Math.round(selectedMix.ratios[color] * 100)}%
          </Text>
        ))}
        <Text style={styles.colorValue}>
          Mixed Colour : {selectedMix.mixed_color.join(', ')}
        </Text>
      </View>
    ) : (
      <Text style={styles.header}>Please select a mix</Text>
    );

    return (
      <View style={styles.container}>
        {/* Buttons to select the mix */}
        <View style={styles.buttonContainer}>
        <View style={styles.buttonWrapper}>
            <Button
              title="Brighter Mix"
              onPress={() => this.handleMixSelection(lighterMix)}
              color={selectedMix === lighterMix ? '#1E90FF' : '#841584'}
              disabled={!lighterMix}
            />
          </View>
          <View style={styles.buttonWrapper}>
            <Button
              title="Actual Mix"
              onPress={() => this.handleMixSelection(actualMix)}
              color={selectedMix === actualMix ? '#1E90FF' : '#841584'}
              disabled={!actualMix}
            />
          </View>
          <View style={styles.buttonWrapper}>
            <Button
              title="Darker Mix"
              onPress={() => this.handleMixSelection(darkerMix)}
              color={selectedMix === darkerMix ? '#1E90FF' : '#841584'}
              disabled={!darkerMix}
            />
          </View>
        </View>

        {/* Selected Colour Display */}
        <View style={styles.selectedColourContainer}>
          <Text style={styles.header}>Selected Colour:</Text>
          {console.log("Selected Colour:", colour)}
          <View style={[styles.colourPreview, { backgroundColor: colour }]} />
          <Text style={styles.colourValue}>{colour}</Text>
        </View>

        {/* Display the selected mix */}
        {mixDisplay}
      </View>
    );
  }
}

ColourDisplay.propTypes = {
  colour: PropTypes.string.isRequired,
  lighterMix: PropTypes.shape({
    ratios: PropTypes.object.isRequired,
    mixed_color: PropTypes.arrayOf(PropTypes.number).isRequired,
  }),
  actualMix: PropTypes.shape({
    ratios: PropTypes.object.isRequired,
    mixed_color: PropTypes.arrayOf(PropTypes.number).isRequired,
  }),
  darkerMix: PropTypes.shape({
    ratios: PropTypes.object.isRequired,
    mixed_color: PropTypes.arrayOf(PropTypes.number).isRequired,
  }),
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f5f5f5',
  },
  buttonContainer: {
    flexDirection: 'row', // Arrange buttons horizontally
    justifyContent: 'flex-start', // Start from the left
    alignItems: 'center',
    marginBottom: 10, // Space below buttons
    flexWrap: 'wrap', // Allow buttons to wrap if necessary
    
  },
  buttonWrapper: {
    marginRight: 10, // Reduced space between buttons
    marginBottom: 10, // Space below buttons when wrapping
    flex: 1, // Allow buttons to shrink to prevent overflow
  },
  selectedColourContainer: {
    alignItems: 'center',
    marginBottom: 20, // Space below color display
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center', // Center the header text
  },
  colourPreview: {
    width: 100,
    height: 100,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  colourValue: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center', // Center the color value text
  },
  mixContainer: {
    alignItems: 'center',
  },
  mixText: {
    fontSize: 16,
    color: '#666',
    marginVertical: 2, // Reduced vertical space between texts
  },
  
});
