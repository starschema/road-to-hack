// For async functions, otherwise we would get "ReferenceError: regeneratorRuntime is not defined"
require('babel-polyfill')

import Config from './config'

import bbox from '@turf/bbox'
import along from '@turf/along'
import turfLength from '@turf/length'
import bearing from '@turf/bearing'
import buffer from '@turf/buffer'
const helper = require('@turf/helpers')


const TABLEAU_ENTERPRISE_STYLE_URL = 'mapbox://styles/tableau-enterprise/'


export default class RoadToHack {

    constructor(config) {
        this.config = config
        this.layerId = 'viz'
        this.style = 'mapbox://styles/tableau-enterprise/cjm1eynpp5f0u2sn1g4nzmax5/'
        this.worksheet = null

        this.mapboxToken = tableau.extensions.settings.get(settingKeys.MAPBOX_TOKEN)

        this.mapboxmap = null
        this.layerDef = {}
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

    createMap(featureColl) {

        if (this.mapboxmap) {
            return
        }

        const container = document.getElementById('container')
        const mapDiv = document.createElement('div')
        mapDiv.setAttribute('id', 'map')
        container.appendChild(mapDiv)

        const replayDiv = document.createElement('div')
        replayDiv.setAttribute('id', 'replay')
        const replayButton = document.createElement('button')
        replayButton.setAttribute('class', 'button btn btn--s')
        const buttonText = 'Replay'
        replayButton.setAttribute('id', buttonText)
        const text = document.createTextNode(buttonText)
        replayButton.appendChild(text)
        replayDiv.appendChild(replayButton)
        container.appendChild(replayDiv)

        mapboxgl.accessToken = this.mapboxToken

        this.setStyle(this.getConfig().styleId)

        // mapboxgl.accessToken = '<your access token here>'
        let map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [-96, 37.8],
            zoom: 3
        })
 
        // San Francisco
        let origin = [-122.414, 37.776]
 
        // Washington DC
        let destination = [-77.032, 38.913]
 
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
 
        // Calculate the distance in kilometers between route start/end point.
        let lineDistance = turfLength(route.features[0], 'kilometers')
 
        let arc = []
 
        // Number of steps to use in the arc and animation, more steps means
        // a smoother arc and animation, but too many steps will result in a
        // low frame rate
        let steps = 1500
 
        // Draw an arc between the `origin` & `destination` of the two points
        for (let i = 0; i < lineDistance; i += lineDistance / steps) {
            let segment = along(route.features[0], i, 'kilometers')
            arc.push(segment.geometry.coordinates)
        }
 
        // Update the route with calculated arc coordinates
        route.features[0].geometry.coordinates = arc
 
        // Used to increment the value of the point measurement against the route.
        let counter = 0
 
        map.on('load', function () {
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
                    'icon-image': 'airport-15',
                    'icon-rotate': ['get', 'bearing'],
                    'icon-rotation-alignment': 'map',
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true
                }
            })
 
            function animate() {
                // Update point geometry to a new position based on counter denoting
                // the index to access the arc.
                point.features[0].geometry.coordinates = route.features[0].geometry.coordinates[counter]
 
                // Calculate the bearing to ensure the icon is rotated to match the route arc
                // The bearing is calculate between the current point and the next point, except
                // at the end of the arc use the previous point and the current point
                point.features[0].properties.bearing = bearing(
                    helper.point(route.features[0].geometry.coordinates[counter >= steps ? counter - 1 : counter]),
                    helper.point(route.features[0].geometry.coordinates[counter >= steps ? counter : counter + 1])
                )
 
                // Update the source with this new data.
                map.getSource('point').setData(point)
 
                // Request the next frame of animation so long the end has not been reached.
                if (counter < steps) {
                    requestAnimationFrame(animate)
                }
 
                counter = counter + 1
            }
 
            document.getElementById('replay').addEventListener('click', function() {
                // Set the coordinates of the original point back to origin
                point.features[0].geometry.coordinates = origin
 
                // Update the source layer
                map.getSource('point').setData(point)
 
                // Reset the counter
                counter = 0
 
                // Restart the animation.
                animate(counter)
            })

            console.log('Created map...')

            // Start the animation.
            animate(counter)
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

                let columnNames = dataTable.columns.map(column => {
                    return column.fieldName.toLowerCase()
                })
                let lat = columnNames.indexOf('latitude')
                let lng = columnNames.indexOf('longitude')

                let points = dataTable.data.map(datum => {
                    let pointProperty = {}
                    return helper.point(
                        [
                            datum[lng].value,
                            datum[lat].value
                        ],
                        pointProperty
                    )
                })

                let featureCollection = helper.featureCollection(points)
                let boundingBox = bbox(buffer(featureCollection, 2))
                console.log('featureCollection', featureCollection)

                this.createMap(featureCollection)
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
