import * as path from "path"
import { lcid } from "../../util/langs"
import { WinPackager } from "../../winPackager"
import { getLicenseFiles } from "../license"
import { NsisOptions } from "./nsisOptions"
import { NsisScriptGenerator } from "./nsisScriptGenerator"
import { nsisTemplatesDir } from "./nsisUtil"

export async function computeLicensePage(packager: WinPackager, options: NsisOptions, scriptGenerator: NsisScriptGenerator, languages: Array<string>): Promise<void> {
  const possibleFiles: Array<string> = []
  for (const name of ["license", "eula"]) {
    for (const ext of ["rtf", "txt", "html"]) {
      possibleFiles.push(`${name}.${ext}`)
      possibleFiles.push(`${name.toUpperCase()}.${ext}`)
      possibleFiles.push(`${name}.${ext.toUpperCase()}`)
      possibleFiles.push(`${name.toUpperCase()}.${ext.toUpperCase()}`)
    }
  }

  const license = await packager.getResource(options.license, ...possibleFiles)
  if (license != null) {
    let licensePage: Array<string>
    if (license.endsWith(".html")) {
      licensePage = [
        "!define MUI_PAGE_CUSTOMFUNCTION_SHOW LicenseShow",
        "Function LicenseShow",
        "  FindWindow $R0 `#32770` `` $HWNDPARENT",
        "  GetDlgItem $R0 $R0 1000",
        "EmbedHTML::Load /replace $R0 file://$PLUGINSDIR\\license.html",
        "FunctionEnd",

        `!insertmacro MUI_PAGE_LICENSE "${path.join(nsisTemplatesDir, "empty-license.txt")}"`,
      ]
    }
    else {
      licensePage = [`!insertmacro MUI_PAGE_LICENSE "${license}"`]
    }

    scriptGenerator.macro("licensePage", licensePage)
    if (license.endsWith(".html")) {
      scriptGenerator.macro("addLicenseFiles", [`File /oname=$PLUGINSDIR\\license.html "${license}"`])
    }
    return
  }

  const licenseFiles = await getLicenseFiles(packager)
  if (licenseFiles.length === 0) {
    return
  }

  const licensePage: Array<string> = []
  const unspecifiedLangs = new Set(languages)

  let defaultFile: string | null = null
  for (const item of licenseFiles) {
    unspecifiedLangs.delete(item.langWithRegion)
    if (defaultFile == null) {
      defaultFile = item.file
    }
    licensePage.push(`LicenseLangString MUILicense ${lcid[item.langWithRegion] || item.lang} "${item.file}"`)
  }

  for (const l of unspecifiedLangs) {
    licensePage.push(`LicenseLangString MUILicense ${lcid[l]} "${defaultFile}"`)
  }

  licensePage.push('!insertmacro MUI_PAGE_LICENSE "$(MUILicense)"')
  scriptGenerator.macro("licensePage", licensePage)
}
