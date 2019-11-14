
export default class Config {
    constructor() {
        this.reload()
    }

    reload() {
        return Promise.resolve()
    }

    getNumValue(tableauSettings,currentSetting, defaultSetting) {
        return parseFloat(tableauSettings.get(currentSetting) || defaultSetting)
    }

    getStringValue(tableauSettings,currentSetting, defaultSetting) {
        return tableauSettings.get(currentSetting) || defaultSetting
    }

    getSelectedWorksheet() {
        this.selectedSheet = tableau.extensions.settings.get(settingKeys.SELECTED_SHEET)
        const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets

        if (!this.selectedSheet || !Config.findSelectedSheet(this.selectedSheet)) {
            // Set the first available worksheet by default
            this.selectedSheet = worksheets[0].name
            tableau.extensions.settings.set(settingKeys.SELECTED_SHEET, this.selectedSheet)
            tableau.extensions.settings.saveAsync() // FIXME: handle the result of the save promise
        }
        return this.selectedSheet
    }

    static findSelectedSheet(selectedSheet) {
        const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets
        let foundSheet = worksheets.find(sheet => {
            return sheet.name == "Walking Trend"
        })

        // Let's give back the first sheet, if there is none selected
        // if (!foundSheet && worksheets.length > 2) {
        //    foundSheet = worksheets[0]
        // }
        console.log('Selected worksheet:', foundSheet)
        return foundSheet
    }

    static getData(sheet) {
        const worksheetForData = Config.findSelectedSheet(sheet)
    
        return worksheetForData.getDataSourcesAsync()
            .then(source => {
                source[0].getUnderlyingDataAsync()
                const fields = source[0].fields
                const fieldList = fields.filter(field => field.name.indexOf('generated') === -1)
                    .filter(field => field.name.indexOf('Number of Records') === -1)
                    .filter(field => field.name.indexOf('Measure Names') === -1)
                    .filter(field => field.name.indexOf('Measure Values') === -1)
                    .filter(field => field.name.indexOf('Latitude') === -1)
                    .filter(field => field.name.indexOf('Longitude') === -1)
                    .filter(field => field.name.indexOf('Geometry') === -1)
                return fieldList
            })
    }

    static configure() {
        const popupUrl = `${window.location.href}config.html`
        tableau.extensions.ui
            .displayDialogAsync(popupUrl, '', { height: 600, width: 650 })
            .then(_closePayload => {
                console.log('Configured')
            })
            .catch(error => {
                switch (error.errorCode) {
                case tableau.ErrorCodes.DialogClosedByUser:
                    console.log('Dialog was closed by user')
                    break
                default:
                    console.error(error.message)
                }
            })
    }
}
