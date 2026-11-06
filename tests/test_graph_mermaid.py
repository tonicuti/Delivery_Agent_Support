import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from backend.agent.graph import build_graph, export_mermaid


class GraphMermaidTests(unittest.TestCase):
    def test_export_contains_real_conditional_routes(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "agent_graph.mmd"
            self.assertEqual(export_mermaid(output), output)
            mermaid = output.read_text(encoding="utf-8")

        self.assertIn("graph TD;", mermaid)
        edges = {(edge.source, edge.target)
                 for edge in build_graph(Path("unused.db")).get_graph().edges}
        self.assertEqual(
            {target for source, target in edges if source == "check_eligibility"},
            {"read_evidence", "score_and_save"},
        )
        self.assertEqual(
            {target for source, target in edges if source == "score_and_save"},
            {"high_worklist", "monitor"},
        )


if __name__ == "__main__":
    unittest.main()
