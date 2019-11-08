// For async functions, otherwise we would get "ReferenceError: regeneratorRuntime is not defined"
require('babel-polyfill')

import Config from './config'

import bbox from '@turf/bbox'
import along from '@turf/along'
import turfLength from '@turf/length'
import bearing from '@turf/bearing'
import buffer from '@turf/buffer'

import { loadMarker, flexTrex, chimed } from './markers'

import { PathDataset, PathInterpolator, getPositionInInterval, zoomLevelForSpeed } from './path-interpolator.js'

const helper = require('@turf/helpers')


const TABLEAU_ENTERPRISE_STYLE_URL = 'mapbox://styles/tableau-enterprise/'

// Number of steps to use in the arc and animation, more steps means
// a smoother arc and animation, but too many steps will result in a
// low frame rate
const STEPS = 1500
// const STEPS = 600

const PROPERTY_TIMESTAMP = 'timestamp'
const PROPERTY_TS_EPOCH = 'ts epoch'
const PROPERTY_TYPE = 'type'
const PROPERTY_USERNAME  = 'username'
const PROPERTY_DISTANCE = 'distance km'
const PROPERTY_LATITUDE = 'latitude'
const PROPERTY_LONGITUDE = 'longitude'
const PROPERTY_SPEED = 'speed kph'

let animate = function (counter) {
    console.log('animate is not yet ready')
}


export default class RoadToHack {

    constructor(config) {
        this.config = config
        this.layerId = 'viz'
        // this.style = 'mapbox://styles/tableau-enterprise/cjm1eynpp5f0u2sn1g4nzmax5/'
        // this.style = 'mapbox://styles/tfoldi/ck2nj0que0mb11couiotta8r4'     // Tableau Conf style
        this.style = 'mapbox://styles/tfoldi/ck2p0z0vy17sr1dqse86clb12'
        this.worksheet = null

        // this.mapboxToken = tableau.extensions.settings.get(settingKeys.MAPBOX_TOKEN)
        this.mapboxToken = 'pk.eyJ1IjoidGZvbGRpIiwiYSI6ImNqdHU5aW9kYTBmMGgzeW9hamJ2azIzOXkifQ.cbq9sfaTiz-fmMDQ5mxM8Q'   // tfoldi

        this.mapboxmap = null
    }

    getMap() {
        return this.mapboxmap
    }

    getConfig() {
        return this.config
    }

    setWorksheet(worksheet) {
        this.worksheet = worksheet
    }

    makeStyleUrl(styleId) {
        if (!styleId) {
            return null
        }
        return `${TABLEAU_ENTERPRISE_STYLE_URL}${styleId}`
    }

    setStyle(styleId) {
        if (!styleId) {
            return
        }

        const styleUrl = this.makeStyleUrl(styleId)
        if (this.style != styleUrl) {
            this.style = styleUrl
            if (this.mapboxmap) {
                this.mapboxmap.setStyle(styleUrl)
            }
        }
    }

    createMap(featureColl, pathInterpolator) {

        console.log('============== Creating map')

        // San Francisco
        let origin = [-122.414, 37.776]

        // Washington DC
        let destination = [-77.032, 38.913]

        // A single point that animates along the route.
        // Coordinates are initially set to origin.
        let point = {
            'type': 'FeatureCollection',
            'features': [{
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'Point',
                    'coordinates': origin
                }
            }]
        }
        
        const features = featureColl.features
        const departureTime = new Date(features[0].properties[PROPERTY_TIMESTAMP])
        const arrivalTime = new Date(features[features.length -1].properties[PROPERTY_TIMESTAMP])
        
        const timeStep = (arrivalTime - departureTime) / STEPS

        // Used to increment the value of the point measurement against the route.
        let lastZoom = 3
        let counter = 0

        let map = this.mapboxmap
        let initializing = !this.mapboxmap

        // A simple line from origin to destination.
        let route = {
            'type': 'FeatureCollection',
            'features': [{
                'type': 'Feature',
                'geometry': {
                    'type': 'LineString',
                    'coordinates': featureColl.features.map(feature => {
                        return feature.geometry.coordinates
                    })
                }
            }]
        }

        // Calculate the distance in kilometers between route start/end point.
        let lineDistance = turfLength(route.features[0], 'kilometers')
        let stepPoints = []
                
        // Make sure that there are enough stops along the route
        for (let i = 0; i < lineDistance; i += lineDistance / STEPS) {
            let segment = along(route.features[0], i, 'kilometers')
            stepPoints.push(segment.geometry.coordinates)
        }
                
        // Update the route with calculated arc coordinates
        route.features[0].geometry.coordinates = stepPoints

        animate = function () {

            const timeOffset = (counter * timeStep)
            const timePoint = pathInterpolator.pathDataset.startTime + timeOffset
            // console.log("timePoint=", timePoint, "timeOffset=", timeOffset)
            const val = pathInterpolator.goToAbsoluteTime(timePoint)
            const interval = val.interval
            // console.log("val=", interval.velocity, "phase=", pathInterpolator.phase)

            const newPosition = getPositionInInterval(val.interval, val.phase)
            // console.log("coords=", JSON.stringify(newPosition.geometry.coordinates), "newPos=", JSON.stringify(newPosition))

            const zoomLevel = zoomLevelForSpeed(interval.velocity)
            const veloStr = `${interval.velocity.toFixed(1)} <i>km/h</i>`

            // Update point geometry to a new position based on counter denoting
            // the index to access the arc.
            point.features[0].geometry.coordinates = newPosition.geometry.coordinates //route.features[0].geometry.coordinates[counter]
            // point.features[0].geometry.coordinates = route.features[0].geometry.coordinates[counter]


            // if (route && route.features.length > 0) {
            // // Calculate the bearing to ensure the icon is rotated to match the route arc
            // // The bearing is calculate between the current point and the next point, except
            // // at the end of the arc use the previous point and the current point
            //     point.features[0].properties.bearing = bearing(
            //         helper.point(route.features[0].geometry.coordinates[counter >= STEPS ? counter - 1 : counter]),
            //         helper.point(route.features[0].geometry.coordinates[counter >= STEPS ? counter : counter + 1])
            //     )
            // }

            let newZoom = lastZoom + ((zoomLevel - lastZoom) / 5.0)
            lastZoom = newZoom
            // map.setZoom(newZoom)
            map.setCenter(newPosition.geometry.coordinates)
            // map.easeTo({
            //   zoom:zoomLevel,
            //   center: newPosition.geometry.coordinates,
            //   duration: 200,
            // });

            // Update the source with this new data.
            map.getSource('point').setData(point)

            // Request the next frame of animation so long the end has not been reached.
            if (counter < STEPS) {
                requestAnimationFrame(animate)
            }

            const timeText = document.getElementById('time-text')
            timeText.innerHTML = veloStr + '<br>' + formatDateTime(new Date(departureTime.getTime() + (counter * timeStep)))

            counter = counter + 1
        }

        let replayClick = function() {
            // // Set the coordinates of the original point back to origin
            // point.features[0].geometry.coordinates = origin

            // // Update the source layer
            // map.getSource('point').setData(point)

            // Reset the counter
            counter = 0

            // Restart the animation.
            animate()
        }

        if (!initializing) {
            point.features[0].geometry.coordinates = origin

            // Update the source layer
            map.getSource('point').setData(point)

            // Reset the counter
            counter = 0

            // Update the route
            map.getSource('route').setData(route)

            document.getElementById('replay').removeEventListener('click', replayClick)
            document.getElementById('replay').addEventListener('click', replayClick)

            // Restart the animation.
            animate()
            return
        }

        const container = document.getElementById('container')
        const mapDiv = document.createElement('div')
        mapDiv.setAttribute('id', 'map')
        container.appendChild(mapDiv)
      
        const replayDiv = document.createElement('div')
        replayDiv.setAttribute('id', 'replay')
        replayDiv.setAttribute('class', 'bottom-right')
        const replayButton = document.createElement('button')
        replayButton.setAttribute('id', 'replay-button')
        replayButton.setAttribute('class', 'button btn btn--s bg-green-light color-black')
        const buttonText = 'Replay'
        replayButton.setAttribute('id', buttonText)
        const text = document.createTextNode(buttonText)
        replayButton.appendChild(text)
        replayDiv.appendChild(replayButton)
        container.appendChild(replayDiv)
      
        mapboxgl.accessToken = this.mapboxToken
      
        this.setStyle(this.getConfig().styleId)
      
        // mapboxgl.accessToken = '<your access token here>'
        map = new mapboxgl.Map({
            container: 'map',
            // style: 'mapbox://styles/mapbox/streets-v11',
            style: this.style,
            center: [-96, 37.8],
            zoom: 3
        })
        this.mapboxmap = map

        console.log('pathInterpolator=', pathInterpolator)

        console.log('departure time', departureTime)
        console.log('arrival time', arrivalTime)

        function formatDateTime(dateTime) {
            const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }
            return dateTime.toLocaleDateString('en-US', options)
        }

        const timeDiv = document.createElement('div')
        timeDiv.setAttribute('id', 'time')
        const timeText = document.createElement('TEXT')
        timeText.setAttribute('id', 'time-text')
        timeText.innerHTML = formatDateTime(departureTime)
        timeDiv.appendChild(timeText)
        timeDiv.setAttribute('class', 'bottom-right color-darken75 txt-bold')
        container.appendChild(timeDiv)

        map.on('load', function () {
            return loadMarker(map, chimed.image, chimed.name)
                .then(() => {
                    // Add a source and layer displaying a point which will be animated in a circle.
                    map.addSource('route', {
                        'type': 'geojson',
                        'data': route
                    })

                    map.addSource('point', {
                        'type': 'geojson',
                        'data': point
                    })

                    map.addLayer({
                        'id': 'route',
                        'source': 'route',
                        'type': 'line',
                        'paint': {
                            'line-width': 2,
                            'line-color': '#007cbf'
                        }
                    })

                    map.addLayer({
                        'id': 'point',
                        'source': 'point',
                        'type': 'symbol',
                        'layout': {
                            'icon-image': chimed.name,
                            'icon-keep-upright': true,
                            'icon-rotate': ['+', ['get', 'bearing'], -90],
                            'icon-rotation-alignment': 'map',
                            'icon-allow-overlap': true,
                            'icon-ignore-placement': true,
                            // 'symbol-placement': 'line',
                        }
                    })

                    document.getElementById('replay').addEventListener('click', replayClick)

                    console.log('Created map...')

                    // Start the animation.
                    animate()
                })
        })
        

        // const worksheet = Config.findSelectedSheet(this.getConfig().selectedSheet)
        // worksheet.getSelectedMarksAsync().then(marks => {
        //     console.log('selected marks', marks)
        // })

        this.mapboxmap = map

        this.mapboxmap.addControl(new mapboxgl.NavigationControl())
    }

    showTableauData() {
        if (!this.worksheet) {
            alert('Worksheet is not selected for extension! Please configure the extension!')
            return
        }

        const config = this.getConfig()

        this.worksheet
            .getUnderlyingDataAsync({ includeAllColumns: true })
            .then(dataTable => {
                if (dataTable.isTotalRowCountLimited) {
                    alert('Attempted to query more data than 10,000 rows, which is the current limitation for Tableau extensions!\n\n' +
                        'Displaying only 10,000 rows.')
                }

                // console.log('dataTable', dataTable)

                const columnNames = dataTable.columns.map(column => {
                    return column.fieldName.toLowerCase()
                })
                const lat = columnNames.indexOf(PROPERTY_LATITUDE)
                const lng = columnNames.indexOf(PROPERTY_LONGITUDE)
                const ts = columnNames.indexOf(PROPERTY_TIMESTAMP)

                const points = dataTable.data.map(d => {
                    let pointProperty = {}
                    pointProperty[PROPERTY_TIMESTAMP] = new Date(d[ts].value)
                    return helper.point(
                        [
                            d[lng].value,
                            d[lat].value
                        ],
                        pointProperty
                    )
                })

                const pathData = dataTable.data.map(d => {

                    let timestampMs = new Date(d[ts].value).getTime()
                    return { timestampMs, lat: d[lat].value, lon: d[lng].value }
                    return helper.point(
                        [
                            d[lng].value,
                            d[lat].value
                        ],
                        pointProperty
                    )
                }).sort((a,b) => a.timestampMs > b.timestampMs ? 1 : -1)

                function comparePoints(pointA, pointB) {
                    const tsA = pointA.properties[PROPERTY_TIMESTAMP]
                    const tsB = pointB.properties[PROPERTY_TIMESTAMP]

                    if (tsA > tsB) return 1
                    if (tsA < tsB) return -1

                    return 0
                }

                // create a dataset out of the points list
                const pathDataset = new PathDataset(pathData)
                console.log('Created PathDataSet', pathDataset)

                // create a path interpolator
                const pathInterpolator = new PathInterpolator(pathDataset)

                const featureCollection = helper.featureCollection(points.sort(comparePoints))
                const boundingBox = bbox(buffer(featureCollection, 2))
                console.log('featureCollection', featureCollection)

                this.createMap(featureCollection, pathInterpolator)
                this.mapboxmap.fitBounds(boundingBox)

                return
            })
    }

    reset() {
        const map = this.getMap()
        map.easeTo({
            center: map.getCenter(),
            pitch: 0,
            bearing: 0
        })
    }
}
