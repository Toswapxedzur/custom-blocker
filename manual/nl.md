# Gebruikershandleiding voor de Vault-browserextensie

Vault beheert websites en ondersteunde platforminhoud in het browserprofiel waarin het is geïnstalleerd. Open de editor via de extensieknop op de werkbalk. Bij verbinding levert Mac Vault of Windows Vault lokale tagging en Activity; de extensie handhaaft browserdoelen.

## Blokkeergroepen

Een **blokkeergroep** past een blokkeerbeleid toe. Een **Classifier-groep** wijst tags toe aan inhoud; die blokkeert zelf niets.

1. Voeg een blokkeergroep toe en geef deze een naam.
2. Kies doelen onder **Van toepassing op**.
3. Kies wanneer blokkeren geldt en stel eventueel een schema of toegestane tijd in.
4. Schakel de groep in. De doelen delen het beleid van de groep.

Gewone wijzigingen worden automatisch opgeslagen. Een fout betekent dat de wijziging niet is geaccepteerd; corrigeer het veld en probeer opnieuw. Schakel een groep uit om het beleid te stoppen en de configuratie te behouden. **Groep verwijderen** verwijdert de groep. Sleep groepen om ze te herschikken. Meerdere groepen kunnen hetzelfde doel raken; uitstel van één groep heft de blokkering door een andere niet op.

**Exporteren** kopieert een groepsconfiguratie. **Importeren** vervangt na bevestiging de configuratie van de geselecteerde groep.

### Toegestane tijd en schema

**Onmiddellijk blokkeren** geldt zodra de ingeschakelde groep overeenkomt en het schema actief is. **Blokkeren zodra de toegestane tijd is gebruikt** staat overeenkomstig gebruik toe totdat de tijd op is.

Stel de toegestane tijd in minuten in en het herstelinterval in uren. Een rollende limiet telt gebruik in het voorafgaande tijdvenster. Een herstel om middernacht begint een nieuwe periode om lokale middernacht, ook voor een rollende limiet.

Kies actieve weekdagen en optionele lokale tijdvensters, één per regel, zoals **09:00-12:00**. Zonder vensters geldt het schema de hele geselecteerde dagen. Een venster moet op dezelfde dag later eindigen dan het begint; splits een nachtelijk schema over aparte dagen.

### Uitstel

Stel uitstel in voor elke blokkeergroep. **Blokkering pauzeren** schort het beleid van die groep op gedurende de pauzetijd. **Aan de toegestane tijd toevoegen** voegt bruikbare minuten toe aan een groep met tijdslimiet. Alleen gebruikte extra tijd telt als uitstel. Ongebruikte extra tijd vervalt bij de volgende reset; bij een rollende limiet na één venster, of eerder om middernacht als die optie aanstaat.

**Activeringsvertraging** stelt uitstel uit terwijl de blokkering doorgaat. **Afkoelperiode** is de wachttijd na afloop van uitstel voordat je het opnieuw kunt aanvragen. **Vereiste bevestigingen** bepaalt het aantal bevestigingsstappen. Uitstel is bij een bevroren groep alleen beschikbaar als het vóór het bevriezen is toegestaan.

### Bevriezen en PIN

**Bevriezen** voorkomt gewone wijzigingen. Ontdooien vereist tien bevestigingen met vijf seconden ertussen, plus de ingestelde wachttijd en een zescijferige PIN. **Wacht vóór ontdooien** accepteert 0–72 uur; 0 voegt geen wachttijd toe.

Tijdens het bevriezen kan de wachttijd worden verlengd en kan een PIN worden toegevoegd als die ontbreekt. Deze voorwaarden kunnen niet worden versoepeld voordat de groep is ontdooid. Verwijderen vereist ook naleving van de resterende wachttijd en PIN.

### Gekoppelde groepen

Gebruik **Koppelen** om expliciet geselecteerde groepen in andere Vault-programma's te verbinden. Gekoppelde groepen delen hun naam, ondersteunde beleidsinstellingen, doelen, gebruik en bevriesvoorwaarden. Elk programma bewerkt en handhaaft de doeltypen die het ondersteunt; andere doelen blijven beschikbaar voor gekoppelde programma's. Ontkoppelen behoudt elke groep en de instellingen ervan.

Als een gekoppeld lid offline is, kan bewerken niet beschikbaar zijn. Open de Vault-desktopapp en de gekoppelde browser om opnieuw te verbinden. Een lokaal opgeslagen beleid kan actief blijven terwijl een lid offline is.

## Hulp krijgen

Klik op de kleine **i** naast een veld voor uitleg. Klik erbuiten of druk op Escape om te sluiten. Lijsten staan in schuifbare vakken; scroll in het vak voor meer items. Zoeken filtert de zichtbare lijst zonder items te verwijderen.

Aangepaste regels hebben een eigen [Codemanual](../code-manual/nl.md). Daarin staan de editor, activering, logboeken, bestandstoegang en de ondersteunde API uitgelegd.

## Websites en platforminhoud

Voeg domeinen of volledige URL's toe, één per item. Een domein omvat subdomeinen. Een pad beperkt overeenkomsten tot dat pad en onderliggende paden. **Alles blokkeren behalve deze sites** maakt van de lijst een toestemmingslijst.

Je kunt dezelfde website meerdere keren toevoegen. Elk item heeft eigen filters en paginabediening; één YouTube-item kan bijvoorbeeld Shorts blokkeren en een ander een creator. Overeenkomende items worden binnen de groep gecombineerd en delen het schema, de toegestane tijd en het uitstel.

Een doel kan een overeenkomende pagina afdekken of eerst pauzeren en na aftellen Doorgaan aanbieden. Een blokkeerdoel gaat binnen dezelfde groep vóór een pauzedoel. **Bij blokkering: omleiden of bericht tonen** accepteert een webadres of afdekbericht; laat dit leeg om de pagina ter plekke af te dekken. Een pauze leidt nooit om.

Platformdoelen gebruiken **Creators** voor videoplatforms, **Accounts** voor Twitter / X, **Communities** voor Reddit en server-/kanaal-ID's voor Discord. Bediening geldt waar Vault de bron en het inhoudstype kan herkennen. Inhoudsbediening verbergt ondersteunde pagina-elementen, zoals advertenties of videokaarten. Browsermachtigingen en websitewijzigingen kunnen deze bediening beïnvloeden.

### Filters voor inhoudstags

De Classifier-verbinding en tagcorrectie zijn beschikbaar in ondersteunde Chromium-browsers, zoals Chrome en Edge, en in Safari Vault op macOS.

Verbind Mac Vault of Windows Vault en configureer Classifier om tags te verkrijgen. Het tagfilter van een blokkeergroep kiest wat wordt afgedekt of verborgen. Het start of pauzeert tagging niet; gebruik de Classifier-instellingen van de desktopapp of de pauzeknop van de afzonderlijke Classifier-groep.

Elk website-item heeft één filter **Toepassen op**: alle inhoud, geselecteerde creators, alles behalve geselecteerde creators, geselecteerde tags of alles behalve geselecteerde tags. Voeg voor een ander filter nog een item voor dezelfde website toe.

Kies bepaalde tags of alles behalve bepaalde tags. Een regel kan tags combineren (**Gaming + Drama**), een betrouwbaarheidsniveau vereisen (**Gaming @3**) of een uitzondering maken (**!Tutorial**). **Inhoud afdekken** houdt tagcorrectie beschikbaar. **Inhoud verbergen** verwijdert het overeenkomende item.

**Ook inhoud zonder betrouwbare tag blokkeren** omvat voltooide resultaten zonder tag bij de standaardbetrouwbaarheidsdrempel, inclusief resultaten met lage betrouwbaarheid. Expliciet vermelde regels worden eerst gecontroleerd. **Niet getagd** betekent dat tagging klaar is zonder tags; **Tagging** betekent dat een resultaat nog wordt verwerkt. De aparte optie voor inhoud in behandeling bepaalt of items worden afgedekt totdat tagging klaar is.

### Tags corrigeren

Klik op **+ tag** naast de tags van een item om de correctiekiezer te openen. Zoek naar bestaande Classifier-tags en kies een tag om toe te voegen. Klik op de verwijderknop van een geselecteerde tag of selecteer deze en druk eenmaal op Delete om te verwijderen. Correcties gaan naar de verbonden desktopapp en worden gebruikt voor toekomstige tagging. Als opzoeken niet beschikbaar is, verschijnt **Niet getagd** en kan dit automatisch opnieuw worden geprobeerd; deze weergave maakt geen tag in Classifier aan.

## Instellingen en verbinding

**Knop voor snel toevoegen + tonen** voegt een kleine knop toe aan ondersteunde pagina's. Selecteer in de lijst een doelgroep; de keuze wordt onthouden wanneer Vault opnieuw wordt geopend. Gebruik de paginaknop om de pagina aan de websitelijst toe te voegen. In een toestemmingslijst staat dit de pagina toe. Bevroren groepen accepteren geen snelle toevoegingen.

De Classifier-verbinding toont de lokale Vault-desktopservice. Configureer Classifier-groepen, modeldownloads, Knowledge, onderzoekstoestemming en API-providers in de verbonden desktopapp.

Als tags ontbreken, controleer dan of de Vault-desktopapp open is, de verbinding werkt, tagging is ingeschakeld, de relevante Classifier-groep is hervat en de platformfeed wordt geregistreerd. Controleer de downloadstatus van het model in de desktopapp. Als blokkeren niet werkt, controleer dan of de groep is ingeschakeld en bekijk doelen, schema, toegestane tijd en uitstelstatus.
