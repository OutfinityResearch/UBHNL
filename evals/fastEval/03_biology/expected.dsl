@Cell:Domain
@Protein:Domain
@c0:Cell

@Producer lambda $c begin
    @rule forall $p Protein begin
        @e Expresses $c $p
        @a Active $p
        implies $e $a
    end
end
