import React, { Component } from 'react';
import { View, Button, StyleSheet, Image } from 'react-native';
import axios from 'axios';
import ColourWheel from './colourWheel';
import ColourSelect from './colourSelect';
import ColourDisplay from './colourDisplay';  // Ensure this is correctly imported

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      showColourWheel: false,
      showColourSelect: false,
      showColourDisplay: false,
      selectedColour: null,
      lighterMix: null,   // Initialize lighterMix in state
      actualMix: null,    // Initialize actualMix in state
      darkerMix: null,    // Initialize darkerMix in state
    };
  }

  // Function to handle the selection of the colour wheel
  handleSelectColour = () => {
    this.setState({ showColourWheel: true, showColourSelect: false, showColourDisplay: false });
  };

  // Function to handle the upload of a photo
  handleUploadPhoto = () => {
    this.setState({ showColourWheel: false, showColourSelect: true, showColourDisplay: false });
  };

  // Function to handle the selection of a colour
  handleColourSelected = (rgba) => {
    if (rgba) {
      console.log('Selected RGB:', rgba);
      this.postColour(rgba);  // Post the colour to the Flask server
    }
    this.setState({ selectedColour: rgba, showColourWheel: false, showColourSelect: false, showColourDisplay: true });
  };

  // Function to post the selected colour to the Flask server
  postColour = async (rgba) => {
    console.log('Posting colour to server:', rgba);  // Log the color being posted
    try {
      const response = await axios.post('http://192.168.0.93:8030/post_colour', { colour: rgba });

      console.log('Response from server:', response.data);  // Log the response
      console.log('Full response from server:', response);

      // Update the state with the response from the server
      this.setState({
        selectedColour: rgba,
        lighterMix: response.data.lighter_mix,  // Set lighterMix from the server response
        actualMix: response.data.actual_mix,    // Set actualMix from the server response
        darkerMix: response.data.darker_mix,    // Set darkerMix from the server response
        showColourWheel: false,
        showColourSelect: false,
      }, () => {
        console.log("Lighter Mix:", this.state.lighterMix);
        console.log("Actual Mix:", this.state.actualMix);
        console.log("Darker Mix:", this.state.darkerMix);
      });
    } catch (error) {
      console.error('Error posting colour:', error);
    }
  };

  render() {
    const { showColourWheel, showColourSelect, selectedColour, showColourDisplay, lighterMix, actualMix, darkerMix } = this.state;

    return (

      <View style={styles.container}>
        {!showColourWheel && !showColourSelect && (
          <View style={styles.buttonContainer}>
          <Image
            source={require('./Craft_mode.jpeg')} 
            style={styles.image}
            resizeMode="contain" 
          />
          <Button title="Select Colour" onPress={this.handleSelectColour} />
          <Button title="Upload Photo" onPress={this.handleUploadPhoto} />
        </View>
        )}

        {showColourWheel && (
          <ColourWheel onColourSelected={this.handleColourSelected} />
        )}

        {showColourSelect && (
          <ColourSelect onColourSelected={this.handleColourSelected} />
        )}

        {/* Pass the selected colour and mix data to ColourDisplay */}
        {showColourDisplay && (
          <ColourDisplay
            colour={selectedColour}
            lighterMix={lighterMix}
            actualMix={actualMix}
            darkerMix={darkerMix}
          />
        )}
      </View>
    );
  }
}

// Styling for the container
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    marginTop: 30,
  },
  image: {
    width: 200,    // Adjust the width as needed
    height: 200,   // Adjust the height as needed
    marginBottom: 20, // Space between image and buttons
  },
  buttonContainer: {
    alignItems: 'center', // Center buttons horizontally
    marginBottom: 30,
  },
});
