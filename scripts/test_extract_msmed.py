import unittest
from extract_msmed import split_sections

class SectionBoundaryTests(unittest.TestCase):
    def pages(self):
        return [
            "15. Alpha.—Test.\n16. Beta.—Test.\n17. Gamma.—Test.\n9\n",
            "18. Delta.—Test.\n19. Epsilon.—Test.\n20. Zeta.—Test.\n21. Eta.—First page.\n10\n",
            "(3) Continued section.\n22. Theta.—Test.\n23. Iota.—Test.\n24. Kappa.—Test.\n25. Lambda.—Excluded.\n11\n",
        ]
    def test_cross_page(self):
        result=split_sections(self.pages())
        self.assertEqual([x[0] for x in result],list(range(15,25)))
        self.assertIn("(3) Continued section.",result[6][2])
        self.assertNotIn("10",result[6][2])
        self.assertEqual(result[0][1],"Alpha")
    def test_missing_boundary(self):
        pages=self.pages()
        pages[0]=pages[0].replace("16.","")
        with self.assertRaises(ValueError):
            split_sections(pages)
    def test_wrong_footer(self):
        pages=self.pages()
        pages[1]=pages[1].replace("10\n","99\n")
        with self.assertRaises(ValueError):
            split_sections(pages)
if __name__=="__main__":
    unittest.main()
