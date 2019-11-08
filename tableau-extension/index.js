const mapboxgl = require('mapbox-gl')

import Config from './src/config'
import RoadToHack from './src/roadToHack'

document.addEventListener('DOMContentLoaded', _event => {
    tableau.extensions.initializeAsync({ configure: Config.configure })
        .then(() => {
            return fetch('https://mapsconfig.tableau.com/v1/config.json')
        })
        .then(response => {
            return response.json()
        })
        .then(configJson => {
            //Will remove once Tableau's style work is complete
            //There is additional logic required to turn on all the layers
            delete configJson.styles['normal']
            delete configJson.styles['outdoors']
            configJson.styles.light.id = defaults.STYLE_ID
            configJson.styles.dark.id = 'cjng92h9g17js2smtbcwz3zv7'
            tableau.extensions.settings.set(settingKeys.MAPBOX_TOKEN, configJson.access_token.token)
            tableau.extensions.settings.set(settingKeys.STYLES, JSON.stringify(configJson.styles))
            return tableau.extensions.settings.saveAsync()
        })
        .then(() => {
            const config = new Config()
            const mapboxExtension = new RoadToHack(config)

            // const elem = document.querySelector('#placeholder')
            // elem.parentNode.removeChild(elem)
            // mapboxExtension.createMap()

            let unregisterSelectionChangedHandler = null

            const setupExtension = () => {
                const config = mapboxExtension.getConfig()
                config.reload()
                    .then(() => {

                        const selectionChangedHandler = (tableauEvent) => {
                            console.log('selection changed event:', tableauEvent)
                            mapboxExtension.showTableauData()
                        }

                        const worksheetToListen = Config.findSelectedSheet(config.selectedSheet)

                        let dashboard = tableau.extensions.dashboardContent.dashboard
                        dashboard.worksheets.forEach(function (worksheet) {
                            // do something with the worksheets..
                            console.log('The worksheet name is ' + worksheet.name)

                            worksheet.addEventListener(
                                tableau.TableauEventType.MarkSelectionChanged,
                                (tableauEvent) => {
                                    console.log(`${new Date()} Selection changed on  ${worksheet.name}`)
                                    console.log('tableau event', tableauEvent)

                                    mapboxExtension.setWorksheet(worksheet)

                                    return selectionChangedHandler(tableauEvent)
                                }
                            )
                        })


                        // Unregister the previously registered click handler, if there is one
                        if (unregisterSelectionChangedHandler) {
                            unregisterSelectionChangedHandler()
                            unregisterSelectionChangedHandler = null
                        }
        
                        unregisterSelectionChangedHandler = worksheetToListen.addEventListener(
                            tableau.TableauEventType.MarkSelectionChanged,
                            selectionChangedHandler
                        )
        
                        mapboxExtension.setStyle(config.styleId)
                        mapboxExtension.setWorksheet(worksheetToListen)
                        mapboxExtension.showTableauData()
                    })
            }

            // Unregister the previously registered click handler, if there is one
            if (unregisterSelectionChangedHandler) {
                unregisterSelectionChangedHandler()
                unregisterSelectionChangedHandler = null
            }

            tableau.extensions.settings.addEventListener(
                tableau.TableauEventType.SettingsChanged,
                _settingsEvent => {
                    setupExtension()
                }
            )

            setupExtension()
        })
        .catch(err => {
            // alert(`Failed to initialize Mapbox extension! ${err}`)
            console.error('Failed to initialize Mapbox extension!', err)
        })
})
