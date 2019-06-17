document.addEventListener('DOMContentLoaded', _event => {

    tableau.extensions.initializeDialogAsync().then(_payload => {
        // Worksheet dropdown
        const sheetSelect = document.getElementById('dropdownSheet')
        const selectedSheet = tableau.extensions.settings.get(settingKeys.SELECTED_SHEET)
        tableau.extensions.dashboardContent.dashboard.worksheets.forEach(worksheet => {
            let option = document.createElement('option')
            let optionText = document.createTextNode(worksheet.name)
            option.appendChild(optionText)
            sheetSelect.appendChild(option)
        })
        if (selectedSheet) {
            sheetSelect.value = selectedSheet
        }
        sheetSelect.addEventListener('change', sheetChangeListener)

        const styleSelect = document.getElementById('dropdownStyle')
        const stylesStr = tableau.extensions.settings.get(settingKeys.STYLES)
        const selectedStyle = tableau.extensions.settings.get(settingKeys.SELECTED_STYLE_NAME)
        const styles = JSON.parse(stylesStr)
        Object.keys(styles).map(styleKey => {
            let option = document.createElement('option')
            let optionText = document.createTextNode(styleKey)
            option.appendChild(optionText)
            styleSelect.appendChild(option)
        })
        if (selectedStyle) {
            styleSelect.value = selectedStyle
        }
        styleSelect.addEventListener('change', styleChangeListener)
    })

    const sheetChangeListener = (event) => {
        const newSheet = event.target.value
        getData(newSheet)
        tableau.extensions.settings.set(settingKeys.SELECTED_SHEET, newSheet)
        return tableau.extensions.settings.saveAsync()
    }

    const styleChangeListener = (event) => {
        const styleName = event.target.value
        const stylesStr = tableau.extensions.settings.get(settingKeys.STYLES)
        const styles = JSON.parse(stylesStr)
        tableau.extensions.settings.set(settingKeys.SELECTED_STYLE_NAME, styleName)
        tableau.extensions.settings.set(settingKeys.SELECTED_STYLE_ID, styles[styleName].id)
        return tableau.extensions.settings.saveAsync()
    }


    const closeDialog = () => {
        console.log('closing dialog and removing event handlers')
        const styleSelect = document.getElementById('dropdownStyle')
        styleSelect.removeEventListener('change', styleChangeListener)
        return tableau.extensions.ui.closeDialog('')
    }
    document.getElementById('config').onclick = closeDialog
})

const getData = (sheet) => {
    const worksheets = tableau.extensions.dashboardContent.dashboard.worksheets
    const worksheetForData = worksheets.find(worksheet => {
        return worksheet.name === sheet
    })
    return worksheetForData.getDataSourcesAsync().then(source => {
        const fields = source[0].fields
        const selectData = document.getElementById('dropdownMeasure')

        // Clear the measure dropdown before we populate it
        while (selectData.hasChildNodes()) {   
            selectData.removeChild(selectData.firstChild)
        }

        const fieldList = fields.filter(field => field.name.indexOf('generated') === -1)
            .filter(field => field.name.indexOf('Number of Records') === -1)
            .filter(field => field.name.indexOf('Measure Names') === -1)
            .filter(field => field.name.indexOf('Measure Values') === -1)
            .filter(field => field.name.indexOf('Latitude') === -1)
            .filter(field => field.name.indexOf('Longitude') === -1)
            .filter(field => field.name.indexOf('Geometry') === -1)
        fieldList.forEach(field => {
            let option = document.createElement('option')
            let optionText = document.createTextNode(field.name)
            option.appendChild(optionText)
            selectData.appendChild(option)
        })
    })
}
