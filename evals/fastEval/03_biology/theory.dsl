@c0:Cell
@c1:Cell
@c2:Cell

@c0 geneA true
@c0 inhibitor false
@c1 geneA true
@c1 inhibitor true
@c2 geneA false

# Schema
forall $c in Cell: geneA($c) and not inhibitor($c) implies proteinP($c)
