"""Production card selection, popup reload, and worker quick-add destination."""
import os
from pathlib import Path

def run(context, worker):
    root = Path(os.environ['EXT_DIR'])
    page = context.new_page()
    extension_id = worker.url.split('/')[2]
    url = f'chrome-extension://{extension_id}/popup.html'
    page.goto(url)
    page.wait_for_function('typeof loadGroups === "function" && state.groupsLoaded')
    page.evaluate((root/'tests/popup-group-selection.js').read_text())
    result = page.evaluate('runGroupSelectionTests()')
    page.reload()
    page.wait_for_function('state.groupsLoaded')
    assert page.evaluate('state.selectedGroupId') == result['chosen']
    target = worker.evaluate('cbQuickAddState()')
    assert target['groupId'] == result['chosen'] and target['enabled']
    worker.evaluate('cbQuickAdd("https://selection-test.example/specific/path?ignored=1#fragment")')
    stored = worker.evaluate('chrome.storage.local.get("blockedGroups")')['blockedGroups']
    destination = next(g for g in stored if g['id'] == result['chosen'])
    assert 'selection-test.example/specific/path' in str(destination)
    assert all('selection-test.example' not in str(g) for g in stored if g['id'] != result['chosen'])
    page.close()
    page = context.new_page()
    page.goto(url)
    page.wait_for_function('state.groupsLoaded')
    assert page.evaluate('state.selectedGroupId') == result['chosen']
    print(f"PASS {result['checks']} popup selection checks; reload/reopen; worker appends only to the selected group")
    page.close()
