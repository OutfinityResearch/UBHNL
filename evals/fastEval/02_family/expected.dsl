@Person:Domain
@p1:Person
@p2:Person
@p3:Person
@f1 Parent $p1 $p2
@f2 Parent $p2 $p3
$f1
$f2

@rule1 forall $x Person begin
    @inner1 forall $y Person begin
        @inner2 forall $z Person begin
            @cond1 Parent $x $y
            @cond2 Ancestor $y $z
            @ant and $cond1 $cond2
            @cons Ancestor $x $z
            implies $ant $cons
        end
    end
end

@rule2 forall $x Person begin
    @inner3 forall $y Person begin
        @c1 Parent $x $y
        @c2 Ancestor $x $y
        implies $c1 $c2
    end
end
