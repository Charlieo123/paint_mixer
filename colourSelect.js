// ColourSelect.js
import React, { Component } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ImageEditor from './ImageEditor';

export default class ColourSelect extends Component {
  constructor(props) {
    super(props);
    this.state = {
      imageUri: null,
    };
  }

  componentDidMount() {
    this.selectImage();
  }

  // Updated selectImage method to present options
  selectImage = () => {
    Alert.alert(
      'Upload Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: this.takePhoto,
        },
        {
          text: 'Choose from Library',
          onPress: this.chooseFromLibrary,
        },
        {
          text: 'Cancel',
          onPress: () => this.props.onColourSelected(null),
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  // Method to handle taking a photo
  takePhoto = async () => {
    try {
      // Request camera permissions
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();

      if (cameraStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
        this.props.onColourSelected(null);
        return;
      }

      // Launch the camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      console.log('Camera result:', result); // Log the result to inspect

      if (!result.canceled) {
        // Access the URI correctly from the assets array
        const imageUri = result.assets[0].uri;
        this.setState({ imageUri });
        console.log('Captured Image URI:', imageUri); // Log the URI
      } else {
        this.props.onColourSelected(null);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'An error occurred while taking the photo.');
      this.props.onColourSelected(null);
    }
  };

  // Existing method to choose an image from the library
  chooseFromLibrary = async () => {
    try {
      // Request media library permissions
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (libraryStatus !== 'granted') {
        Alert.alert('Permission Denied', 'Media library permission is required.');
        this.props.onColourSelected(null);
        return;
      }

      // Launch the image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      console.log('ImagePicker result:', result); // Log the result to inspect

      if (!result.canceled) {
        // Access the URI correctly from the assets array
        const imageUri = result.assets[0].uri;
        this.setState({ imageUri });
        console.log('Selected Image URI:', imageUri); // Log the URI
      } else {
        this.props.onColourSelected(null);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'An error occurred while selecting the image.');
      this.props.onColourSelected(null);
    }
  };

  // Handle color selection from ImageEditor
  handleColourSelected = (rgb) => {
    console.log('Selected RGB:', rgb);
    this.props.onColourSelected(rgb);
  };

  render() {
    const { imageUri } = this.state;
    console.log('Passing Image URI to ImageEditor:', imageUri); // Log the URI

    if (!imageUri) {
      return <View style={styles.container} />;
    }

    return (
      <View style={styles.container}>
        <ImageEditor
          imageUri={imageUri}
          onColourSelected={this.handleColourSelected}
          onCancel={() => this.props.onColourSelected(null)}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
