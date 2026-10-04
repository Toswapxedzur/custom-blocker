"""Check actual upload archives against the Store/development identity boundary."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("vault_package", Path(__file__).parents[1] / "tools/package.py")
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class PackageIdentityTests(unittest.TestCase):
    def test_store_and_development_archives(self):
        output_root = package.REPO_ROOT / "dist"
        output_root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=output_root) as directory:
            package.DIST_DIR = Path(directory)
            for environment in ("development", "production"):
                for target in ("chrome", "edge"):
                    with self.subTest(environment=environment, target=target):
                        archive = package.build_target(target, environment)
                        with zipfile.ZipFile(archive) as zipped:
                            manifest = json.loads(zipped.read("manifest.json"))
                            self.assertEqual("key" in manifest, environment == "development")
                            self.assertEqual(manifest["background"], {"service_worker": "service-worker.js"})
                            self.assertIn("offscreen.html", zipped.namelist())
                            self.assertNotIn("sandbox-transport.js", zipped.namelist())

    def test_retired_engine_cannot_be_packaged(self):
        with self.assertRaises(ValueError):
            package.manifest_for("firefox")


if __name__ == "__main__":
    unittest.main()
