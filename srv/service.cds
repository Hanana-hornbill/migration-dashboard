using {my.app as my} from '../db/schema';

service EmployeeService {

    @UI.LineItem: [
        {
            Value: ID,
            Label: 'Employee ID'
        },
        {
            Value: name,
            Label: 'Name'
        },
        {
            Value: role,
            Label: 'Role'
        }
    ]

    entity Employees as projection on my.Employees;
}