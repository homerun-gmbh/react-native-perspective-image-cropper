
import React, { Component } from 'react';
import { get, isEmpty } from 'lodash';
import {
  NativeModules,
  PanResponder,
  Dimensions,
  Image,
  View,
  Animated,
  Platform
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

class CustomCrop extends Component {
  constructor(props) {
    super(props);
    this.state = {
      viewHeight:
        Dimensions.get('window').width * (props.height / props.width),
      viewWidth: Dimensions.get('window').width,
      height: props.height,
      width: props.width,
      image: props.initialImage,
      moving: false,
      screenRatio: Dimensions.get('screen').height / Dimensions.get('screen').width
    };

    const rectangleCoordinates = get(props, 'rectangleCoordinates', {});

    const {
      topLeft,
      topRight,
      bottomLeft,
      bottomRight
    } = Platform.select({
      ios: this.computeIosCoordinates(rectangleCoordinates),
      android: rectangleCoordinates
    })

    this.animatedCoordinates = {
      topLeft: new Animated.ValueXY(
        isEmpty(rectangleCoordinates) ?
          { x: 100, y: 100 }
          : this.imageCoordinatesToViewCoordinates({ ...topLeft })
      ),
      topRight: new Animated.ValueXY(
        isEmpty(rectangleCoordinates) ?
          { x: this.state.viewWidth - 100, y: 100 }
          : this.imageCoordinatesToViewCoordinates({ ...topRight })
      ),
      bottomLeft: new Animated.ValueXY(
        isEmpty(rectangleCoordinates) ?
          { x: 100, y: this.state.viewHeight - 100 }
          : this.imageCoordinatesToViewCoordinates({ ...bottomLeft })
      ),
      bottomRight: new Animated.ValueXY(
        isEmpty(rectangleCoordinates) ?
          {
            x: this.state.viewWidth - 100,
            y: this.state.viewHeight - 100,
          }
          : this.imageCoordinatesToViewCoordinates({ ...bottomRight })
      )

    };

    this.state = {
      ...this.state,
      overlayPositions: `${this.animatedCoordinates.topLeft.x.__getValue()},${this.animatedCoordinates.topLeft.y.__getValue()
        } ${this.animatedCoordinates.topRight.x.__getValue()},${this.animatedCoordinates.topRight.y.__getValue()} ${this.animatedCoordinates.bottomRight.x.__getValue()
        },${this.animatedCoordinates.bottomRight.y.__getValue()} ${this.animatedCoordinates.bottomLeft.x.__getValue()
        },${this.animatedCoordinates.bottomLeft.y._value}`
    }

    this.panResponderTopLeft = this.createPanResponser(this.animatedCoordinates.topLeft);
    this.panResponderTopRight = this.createPanResponser(
      this.animatedCoordinates.topRight,
    );
    this.panResponderBottomLeft = this.createPanResponser(
      this.animatedCoordinates.bottomLeft,
    );
    this.panResponderBottomRight = this.createPanResponser(
      this.animatedCoordinates.bottomRight,
    );
    this.coordinateScaleRation = (props.width / this.state.viewHeight) * 1.20
  }

  computeIosCoordinates(rectangleCoordinates) {
    return Object.entries(rectangleCoordinates).reduce(
      (iosRectangles, coordinates) => {
        const [key, value] = coordinates
        return {
          ...iosRectangles,
          [key]: {
            x: value.x * this.coordinateScaleRation,
            y: value.y * this.coordinateScaleRation
          }
        }
      }, {}
    )
  }

  createPanResponser(corner) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([
        null,
        {
          dx: corner.x,
          dy: corner.y,
        },
      ], {
        useNativeDriver: false, listener: (event, gestureState) => {
          this.updateOverlayString()
        }
      })
      ,
      onPanResponderRelease: () => {
        corner.flattenOffset();
        this.updateOverlayString();
      },
      onPanResponderGrant: () => {
        corner.setOffset({ x: corner.x._value, y: corner.y._value });
        corner.setValue({ x: 0, y: 0 });
      },
    });
  }

  crop() {
    const coordinates = {
      topLeft: this.viewCoordinatesToImageCoordinates(this.animatedCoordinates.topLeft),
      topRight: this.viewCoordinatesToImageCoordinates(
        this.animatedCoordinates.topRight,
      ),
      bottomLeft: this.viewCoordinatesToImageCoordinates(
        this.animatedCoordinates.bottomLeft,
      ),
      bottomRight: this.viewCoordinatesToImageCoordinates(
        this.animatedCoordinates.bottomRight,
      ),
      height: this.state.height,
      width: this.state.width,
    };
    NativeModules.CustomCropManager.crop(
      coordinates,
      this.state.image,
      (err, res) => this.props.updateImage(res.image, coordinates),
    );
  }

  updateOverlayString() {
    this.setState({
      overlayPositions: `${this.animatedCoordinates.topLeft.x.__getValue()},${this.animatedCoordinates.topLeft.y.__getValue()
        } ${this.animatedCoordinates.topRight.x.__getValue()},${this.animatedCoordinates.topRight.y.__getValue()} ${this.animatedCoordinates.bottomRight.x.__getValue()
        },${this.animatedCoordinates.bottomRight.y.__getValue()} ${this.animatedCoordinates.bottomLeft.x.__getValue()
        },${this.animatedCoordinates.bottomLeft.y.__getValue()}`,
    });
  }

  imageCoordinatesToViewCoordinates(corner) {
    return {
      x: (corner.x * this.state.viewWidth) / this.state.width,
      y: (corner.y * this.state.viewHeight) / this.state.height,
    };
  }

  viewCoordinatesToImageCoordinates(corner) {
    return {
      x: (corner.x._value / this.state.viewWidth) *
        this.state.width,
      y: (corner.y._value / this.state.viewHeight) * this.state.height
    };
  };



  render() {
    return (
      <View
        style={[
          styles.cropContainer,
          { height: this.state.viewHeight, borderWidth: 3, borderColor: 'red' },
        ]}
      >
        <Image
          style={[
            styles.image,
            { height: '100%', width: '100%' }
          ]}
          resizeMode="contain"
          source={{ uri: this.state.image }}
        />
        <Animated.View>
          <Svg
            height={this.state.viewHeight}
            width={this.state.viewWidth}
            style={{ position: 'absolute' }}
          >
            <AnimatedPolygon
              ref={(ref) => (this.polygon = ref)}
              fill={this.props.overlayColor || '#f85b2c'}
              fillOpacity={this.props.overlayOpacity || 0.5}
              stroke={this.props.overlayStrokeColor || '#f85b2c'}
              points={this.state.overlayPositions}
              strokeWidth={this.props.overlayStrokeWidth || 3}
            />
          </Svg>
        </Animated.View>
        <Animated.View
          {...this.panResponderTopLeft.panHandlers}
          style={[
            this.animatedCoordinates.topLeft.getLayout(),
            styles.panResponder,
            { marginTop: -65, marginLeft: -65 }
          ]}
        >
          <View style={[styles.handler]} />
        </Animated.View>
        <>
          <Animated.View
            {...this.panResponderTopRight.panHandlers}
            style={[
              this.animatedCoordinates.topRight.getLayout(),
              styles.panResponder,
              { marginLeft: -15, marginTop: -65 }
            ]}
          >
            <View style={[styles.handler]} />
          </Animated.View>
          <Animated.View
            {...this.panResponderBottomLeft.panHandlers}
            style={[
              this.animatedCoordinates.bottomLeft.getLayout(),
              styles.panResponder,
              { marginLeft: -65, marginTop: -15 }
            ]}
          >
            <View style={[styles.handler]} />
          </Animated.View>
        </>
        <Animated.View
          {...this.panResponderBottomRight.panHandlers}
          style={[
            this.animatedCoordinates.bottomRight.getLayout(),
            styles.panResponder,
            { marginLeft: -15, marginTop: -15 }
          ]}
        >
          <View style={[styles.handler]} />
        </Animated.View>
      </View>
    );
  }
}

const styles = {

  handler: {
    width: 45,
    position: 'absolute',
    height: 45,
    borderRadius: 25,
    backgroundColor: '#f85b2c',
    zIndex: 9999,
    borderColor: 'red'
  },
  image: {
    width: Dimensions.get('window').width,
    position: 'absolute',
  },
  panResponder: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  cropContainer: {
    position: 'absolute',
    left: 0,
    width: Dimensions.get('window').width,
    top: 0,
  },
};

export default CustomCrop;