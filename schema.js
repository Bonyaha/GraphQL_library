const typeDefs = `
enum YesNo {  YES  NO}

  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
}

  type Token {
    value: String!
}

	type Book {
		title: String!
		published:Int!
		author: Author!
		id: ID!
		genres:[String!]!  
}
type Author {
		name:String!
		id: ID!
		born: Int
		bookCount: Int 
		books: [Book!]
}
  type Query {
    bookCount: Int!
		authorCount: Int!
		allBooks(author: String, genre: String):[Book!]!
		allAuthors: [Author!]!
		findAuthor(name: String!): Author
		findBook(title: String!): Book
		booksByGenre(genre: String!): [Book]
		booksByAuthor(author: String!): [Book]
    me: User
  }
	
type Mutation {
  addBook(
    title: String!
		published:Int!
		author: String!
		genres:[String!]!
  ): Book
editAuthor(
    name: String! 
    setBornTo: Int!
  ): Author
createUser(
    username: String!
    favoriteGenre: String!
  ): User
  login(
    username: String!
    password: String!
  ): Token
}
	type Subscription {
		bookAdded: Book!
		authorAdded: Author!
}	
`

module.exports = typeDefs